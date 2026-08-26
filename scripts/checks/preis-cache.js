// PRÜFT: der Preis-Cache — durch AUSFÜHREN der echten Funktionen.
//
// WARUM (26.08.). Bis heute rief `priceCache.set()` im ganzen Programm
// NIEMAND auf. Drei Ansichten lasen daraus: die Mission-Control-Kachel
// "Market Data", `/api/market-data/status` und `/api/market-regime/classify` —
// letztere wird im Dashboard alle 20 Sekunden geholt. Alle drei bekamen
// dauerhaft eine leere Liste, und die Oberfläche schrieb "Live" darüber.
//
// DER BEFUND, DER DEN NAHELIEGENDEN FIX ZUNICHTE GEMACHT HÄTTE: der Zustand
// lag in einer modul-scoped `Map`. Genau daran ist in diesem Projekt am
// 28.07. schon der Killswitch gescheitert (killswitch-engine.ts:12):
// API-Routen und die Loops in instrumentation.ts sehen verschiedene Kopien
// des Moduls. Ein Cache, den der Handelszyklus füllt und den eine Route
// liest, wäre für die Route WEITERHIN LEER geblieben — die Anzeige sähe
// repariert aus, ohne es zu sein.
//
// Teil 1 unten bildet genau das nach: das Modul wird ZWEIMAL geladen (zwei
// Instanzen, wie sie Next.js erzeugt), über die eine geschrieben und über die
// andere gelesen. Auf `global` gelingt das, modul-scoped nicht. Diesen Fehler
// kann keine Struktur-Prüfung sehen — nur eine Rechnung.
const { read, ladeTsModul } = require("./_lib");

const PFAD_CACHE = "lib/market-data-engine/price-cache.ts";
const PFAD_HEALTH = "lib/market-data-engine/market-health.ts";

/** Kommentare und Zeichenketten raus, bevor gezählt wird, ob etwas BENUTZT
 *  wird. Ein Wort im Kommentar ist keine Verwendung — diese Fehlerklasse hat
 *  in diesem Repository 2026 sechsmal zugeschlagen. */
function ohneKommentareUndTexte(quelltext) {
  return quelltext
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `[^:]` davor — sonst frisst das Muster "https://…" in einer
    // Zeichenkette und mit ihm den ganzen Zeilenrest (lifecycle-rueckkehr.js:79).
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  // Der Zustand liegt auf `global`. Vor jedem Lauf aufräumen, damit ein
  // anderer Prüfer im selben Prozess uns nicht beeinflusst — und danach auch.
  delete global.__price_cache__;

  const a = ladeTsModul(PFAD_CACHE);
  if (a.fehler) return { titel: "Preis-Cache", funde: [a.fehler] };
  const { priceCache, preiseUebernehmen, CACHE_MAX_ALTER_MS } = a.exports;

  if (typeof preiseUebernehmen !== "function" || !priceCache) {
    return {
      titel: "Preis-Cache",
      funde: ["preiseUebernehmen/priceCache werden nicht exportiert — Umbenennung?"],
    };
  }

  const echtesLog = console.log;
  const echtesWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};

  try {
    // ── Teil 1: zwei Modul-Instanzen teilen den Zustand ──────────────────
    //
    // Das ist die Kernprüfung. Sie bildet den Fall nach, an dem am 28.07.
    // schon der Killswitch gescheitert ist.
    priceCache.leeren();
    preiseUebernehmen([
      { symbol: "XAUUSD", bid: 2400, ask: 2400.5, spread: 0.5, updateTime: "2026-08-26T10:00:00Z", priceSource: "CAPITAL" },
    ]);

    const b = ladeTsModul(PFAD_CACHE);
    pruefe1("zweite Modul-Instanz laesst sich nicht laden", !b.fehler, b.fehler);
    if (!b.fehler) {
      const ausB = b.exports.priceCache.getAll();
      pruefe1(
        "der Zustand ist NICHT geteilt — modul-scoped statt global",
        ausB.length === 1 && ausB[0].symbol === "XAUUSD",
        `zweite Instanz sieht ${ausB.length} Kurse. Genau so hat der Killswitch `
        + `am 28.07. versagt: API-Route und Loop sahen verschiedene Kopien.`
      );
    }

    // ── Teil 2: was NICHT in den Cache darf ──────────────────────────────
    //
    // Ein Kurs von 0 oder NaN im Cache ergäbe in der Regime-Einstufung einen
    // Mittelwert 0 und einen Spread-Anteil 0 — eine Kennzahl, der man nicht
    // ansieht, dass sie erfunden ist. NaN steht mit drin, weil eine Prüfung,
    // die nur `bid <= 0` schreibt, ihn durchlässt: `NaN <= 0` ist FALSE.
    const muell = [
      ["bid 0", { symbol: "X", bid: 0, ask: 1 }],
      ["ask 0", { symbol: "X", bid: 1, ask: 0 }],
      ["bid negativ", { symbol: "X", bid: -1, ask: 1 }],
      ["ask negativ", { symbol: "X", bid: 1, ask: -1 }],
      ["bid NaN", { symbol: "X", bid: NaN, ask: 1 }],
      ["ask NaN", { symbol: "X", bid: 1, ask: NaN }],
      ["bid Infinity", { symbol: "X", bid: Infinity, ask: 1 }],
      ["ask Infinity", { symbol: "X", bid: 1, ask: Infinity }],
      ["bid fehlt", { symbol: "X", ask: 1 }],
      ["ask fehlt", { symbol: "X", bid: 1 }],
      ["bid null", { symbol: "X", bid: null, ask: 1 }],
      ["bid Text", { symbol: "X", bid: "kaputt", ask: 1 }],
      ["Symbol fehlt", { bid: 1, ask: 1.1 }],
      ["Symbol leer", { symbol: "", bid: 1, ask: 1.1 }],
    ];
    for (const [name, eintrag] of muell) {
      priceCache.leeren();
      const n = preiseUebernehmen([eintrag]);
      pruefe1(`"${name}" wird uebernommen`, n === 0 && priceCache.getAll().length === 0,
        `uebernommen=${n}, im Cache=${priceCache.getAll().length}`);
    }

    // Kaputte Zeile darf die gute daneben nicht mitreissen.
    priceCache.leeren();
    const gemischt = preiseUebernehmen([
      { symbol: "KAPUTT", bid: NaN, ask: 1 },
      { symbol: "GUT", bid: 1.1, ask: 1.2, spread: 0.1, priceSource: "CAPITAL" },
    ]);
    pruefe1("eine kaputte Zeile verwirft auch die gute", gemischt === 1,
      `uebernommen=${gemischt}`);

    // ── Teil 3: gültige Kurse landen richtig ─────────────────────────────
    priceCache.leeren();
    preiseUebernehmen([
      { symbol: "EURUSD", bid: 1.16453, ask: 1.16465, spread: 0.00012, updateTime: "2026-08-26T09:30:00Z", priceSource: "CAPITAL" },
      { symbol: "BTCUSD", bid: 64000, ask: 64012.5, spread: 12.5, updateTime: "", priceSource: "YFINANCE_FALLBACK" },
    ]);
    const eur = priceCache.get("EURUSD");
    const btc = priceCache.get("BTCUSD");
    pruefe1("EURUSD fehlt im Cache", !!eur);
    pruefe1("BTCUSD fehlt im Cache", !!btc);
    if (eur && btc) {
      pruefe1("bid falsch uebernommen", eur.bid === 1.16453, `${eur.bid}`);
      pruefe1("ask falsch uebernommen", eur.ask === 1.16465, `${eur.ask}`);
      pruefe1("spread falsch uebernommen", eur.spread === 0.00012, `${eur.spread}`);
      pruefe1("Broker-Herkunft falsch abgebildet", eur.source === "CAPITAL_COM", eur.source);
      pruefe1("yfinance-Herkunft falsch abgebildet", btc.source === "PYTHON_YFINANCE", btc.source);
      pruefe1("Quell-Zeitstempel nicht uebernommen",
        eur.timestamp === "2026-08-26T09:30:00Z", eur.timestamp);
      // Fund 02.08.: ein fehlender Zeitstempel darf NICHT mit der aktuellen
      // Uhrzeit gefüllt werden. Genau so sah ein 57 Stunden alter Kurs
      // taufrisch aus.
      //
      // BEIDE Schreibweisen von "fehlt" müssen geprüft werden. Im
      // Sabotage-Lauf vom 26.08. ist der Umbau auf `new Date()` zunächst
      // DURCHGERUTSCHT, weil hier nur der leere Text getestet wurde:
      // `"" ?? x` ergibt `""`, der Nullish-Operator greift nur bei
      // undefined/null. Der Orchestrator liefert `""` (er schreibt selbst
      // `p.updateTime ?? ""`), ein direkter Aufrufer aber liesse das Feld weg.
      pruefe1("leerer Quell-Zeitstempel wird ueberschrieben",
        btc.timestamp === "", `timestamp="${btc.timestamp}"`);
      pruefe1("receivedAt fehlt", typeof eur.receivedAt === "string"
        && Number.isFinite(Date.parse(eur.receivedAt)), eur.receivedAt);
    }

    // Feld GANZ weggelassen — der Fall, den `?? ""` wirklich abfängt.
    priceCache.leeren();
    preiseUebernehmen([{ symbol: "OHNE_ZEIT", bid: 5, ask: 5.1, priceSource: "CAPITAL" }]);
    const ohneZeit = priceCache.get("OHNE_ZEIT");
    pruefe1("fehlender Quell-Zeitstempel wird mit JETZT gefuellt (Fund 02.08.)",
      ohneZeit && ohneZeit.timestamp === "",
      ohneZeit && `timestamp="${ohneZeit.timestamp}"`);
    // Und er darf auch nicht heimlich aus receivedAt abgeschrieben werden.
    pruefe1("Quell-Zeitstempel wird aus receivedAt abgeschrieben",
      ohneZeit && ohneZeit.timestamp !== ohneZeit.receivedAt);

    // Spread fehlt -> aus ask-bid gerechnet, nicht weggelassen.
    priceCache.leeren();
    preiseUebernehmen([{ symbol: "OHNE", bid: 100, ask: 100.25, priceSource: "CAPITAL" }]);
    const ohne = priceCache.get("OHNE");
    pruefe1("fehlender Spread wird nicht ausgerechnet",
      ohne && Math.abs(ohne.spread - 0.25) < 1e-9, ohne && `${ohne.spread}`);

    // ── Teil 4: Vorgänger wird mitgeführt ────────────────────────────────
    //
    // Ohne previousBid/previousAsk rechnet detectTrend() IMMER
    // priceChangePercent 0 und meldet RANGING mit Score 50 — für jedes Symbol,
    // für immer. Die ganze Regime-Anzeige wäre eine Konstante.
    priceCache.leeren();
    preiseUebernehmen([{ symbol: "M", bid: 100, ask: 100.1, priceSource: "CAPITAL" }]);
    const erst = priceCache.get("M");
    pruefe1("erster Eintrag hat schon einen Vorgaenger",
      erst && erst.previousBid === undefined, erst && `${erst.previousBid}`);
    preiseUebernehmen([{ symbol: "M", bid: 101, ask: 101.1, priceSource: "CAPITAL" }]);
    const zweit = priceCache.get("M");
    pruefe1("Vorgaenger-bid wird nicht mitgefuehrt",
      zweit && zweit.previousBid === 100, zweit && `${zweit.previousBid}`);
    pruefe1("Vorgaenger-ask wird nicht mitgefuehrt",
      zweit && Math.abs(zweit.previousAsk - 100.1) < 1e-9,
      zweit && `${zweit.previousAsk}`);
    pruefe1("aktueller Kurs wurde nicht aktualisiert",
      zweit && zweit.bid === 101, zweit && `${zweit.bid}`);

    // Ein ABGELAUFENER Vorgänger darf nicht als Vergleich dienen.
    //
    // Stand der Handelszyklus drei Stunden still, wäre die Bewegung dieser
    // drei Stunden sonst als Bewegung EINES Zyklus ausgewiesen worden — aus
    // "+2,7 % über Nacht" würde ein STRONG_BULL "gerade eben". Nach einem
    // Ausfall muss die Messung sauber von vorn beginnen.
    priceCache.leeren();
    priceCache.set({
      symbol: "LUECKE", bid: 3358, ask: 3358.5, spread: 0.5, timestamp: "",
      receivedAt: new Date(Date.now() - (CACHE_MAX_ALTER_MS + 60_000)).toISOString(),
      source: "CAPITAL_COM",
    });
    preiseUebernehmen([{ symbol: "LUECKE", bid: 3450, ask: 3450.5, spread: 0.5, priceSource: "CAPITAL" }]);
    const nachLuecke = priceCache.get("LUECKE");
    pruefe1("abgelaufener Vorgaenger wird als Vergleich benutzt — eine "
      + "Bewegung ueber Stunden erschiene als Bewegung eines Zyklus",
      nachLuecke && nachLuecke.previousBid === undefined,
      nachLuecke && `previousBid=${nachLuecke.previousBid}`);
    pruefe1("der neue Kurs kam nach der Luecke nicht an",
      nachLuecke && nachLuecke.bid === 3450, nachLuecke && `${nachLuecke.bid}`);

    // ── Teil 5: Verfall ──────────────────────────────────────────────────
    //
    // Ein stehengebliebener Handelszyklus darf keine stundenalten Kurse als
    // aktuell ausgeben. Das ist derselbe Fehler wie am 02.08., nur eine
    // Schicht höher.
    pruefe1("CACHE_MAX_ALTER_MS wird nicht exportiert",
      typeof CACHE_MAX_ALTER_MS === "number" && CACHE_MAX_ALTER_MS > 0,
      `${CACHE_MAX_ALTER_MS}`);
    pruefe1("Verfallsfrist unplausibel (unter 1 Min oder ueber 1 Std)",
      CACHE_MAX_ALTER_MS >= 60_000 && CACHE_MAX_ALTER_MS <= 3_600_000,
      `${CACHE_MAX_ALTER_MS} ms`);

    const setzeMitAlter = (symbol, alterMs) => {
      priceCache.set({
        symbol, bid: 1, ask: 1.1, spread: 0.1, timestamp: "",
        receivedAt: new Date(Date.now() - alterMs).toISOString(),
        source: "CAPITAL_COM",
      });
    };

    priceCache.leeren();
    setzeMitAlter("FRISCH", 1000);
    setzeMitAlter("ALT", CACHE_MAX_ALTER_MS + 60_000);
    const uebrig = priceCache.getAll();
    pruefe1("abgelaufener Kurs bleibt in getAll()",
      uebrig.length === 1 && uebrig[0].symbol === "FRISCH",
      `${uebrig.map((p) => p.symbol).join(",")}`);
    pruefe1("abgelaufener Kurs kommt ueber get() zurueck",
      priceCache.get("ALT") === undefined);
    pruefe1("frischer Kurs verschwindet", !!priceCache.get("FRISCH"));

    // Genau an der Grenze: knapp darunter muss bleiben.
    priceCache.leeren();
    setzeMitAlter("GRENZE", CACHE_MAX_ALTER_MS - 5_000);
    pruefe1("Kurs knapp INNERHALB der Frist wird verworfen",
      priceCache.getAll().length === 1, `${priceCache.getAll().length}`);

    // Unlesbarer Zeitstempel gilt als abgelaufen — fail-safe. Ein Prüfer, der
    // hier "frisch" akzeptiert, lässt kaputte Daten als aktuell durchgehen.
    priceCache.leeren();
    priceCache.set({ symbol: "KAPUTT", bid: 1, ask: 1.1, spread: 0.1,
      timestamp: "", receivedAt: "voelliger Unsinn", source: "CAPITAL_COM" });
    pruefe1("unlesbarer receivedAt gilt als frisch",
      priceCache.getAll().length === 0, `${priceCache.getAll().length}`);

    // alterMinuten()
    priceCache.leeren();
    pruefe1("alterMinuten() meldet bei leerem Cache keine null",
      priceCache.alterMinuten() === null, `${priceCache.alterMinuten()}`);
    setzeMitAlter("A", 5 * 60 * 1000);
    setzeMitAlter("B", 1 * 60 * 1000);
    const alter = priceCache.alterMinuten();
    pruefe1("alterMinuten() meldet nicht den JUENGSTEN Eintrag",
      alter !== null && Math.abs(alter - 1) < 0.2, `${alter}`);

    // ── Teil 6: market-health leitet ab statt zu behaupten ───────────────
    //
    // Hier standen bis zum 26.08. drei fest eingebaute Zeilen, davon zwei
    // nachweislich falsch: TradingView "connected, 20 ms Latenz" (dieses
    // Programm holt von dort KEINE Kurse) und Capital.com "nicht verbunden"
    // (es IST der Live-Broker).
    const h = ladeTsModul(PFAD_HEALTH, { "price-cache": { priceCache } });
    pruefe1("market-health laesst sich nicht laden", !h.fehler, h.fehler);
    if (!h.fehler && h.exports.marketHealth) {
      priceCache.leeren();
      const leer = h.exports.marketHealth.getStatus();
      const capLeer = leer.find((s) => s.source === "CAPITAL_COM");
      pruefe1("CAPITAL_COM fehlt in der Feed-Liste", !!capLeer);
      pruefe1("CAPITAL_COM meldet 'verbunden' bei LEEREM Cache",
        capLeer && capLeer.connected === false);
      pruefe1("leerer Cache meldet trotzdem Kurse",
        capLeer && capLeer.prices === 0, capLeer && `${capLeer.prices}`);
      pruefe1("leerer Cache meldet ein Alter",
        capLeer && capLeer.ageMinutes === null, capLeer && `${capLeer.ageMinutes}`);

      preiseUebernehmen([
        { symbol: "S1", bid: 1, ask: 1.1, priceSource: "CAPITAL" },
        { symbol: "S2", bid: 2, ask: 2.1, priceSource: "CAPITAL" },
        { symbol: "S3", bid: 3, ask: 3.1, priceSource: "YFINANCE_FALLBACK" },
      ]);
      const voll = h.exports.marketHealth.getStatus();
      const cap = voll.find((s) => s.source === "CAPITAL_COM");
      const py = voll.find((s) => s.source === "PYTHON_YFINANCE");
      const tv = voll.find((s) => s.source === "TRADINGVIEW");
      pruefe1("CAPITAL_COM meldet nicht 'verbunden' obwohl Kurse da sind",
        cap && cap.connected === true);
      pruefe1("CAPITAL_COM zaehlt die Kurse falsch",
        cap && cap.prices === 2, cap && `${cap.prices}`);
      pruefe1("PYTHON_YFINANCE zaehlt die Kurse falsch",
        py && py.prices === 1, py && `${py.prices}`);
      pruefe1("TRADINGVIEW fehlt in der Liste", !!tv);
      pruefe1("TRADINGVIEW meldet wieder 'verbunden' — dieses Programm holt "
        + "von dort keine Kurse", tv && tv.connected === false);
      pruefe1("TRADINGVIEW begruendet sein Fehlen nicht",
        tv && typeof tv.note === "string" && tv.note.length > 0);
      pruefe1("latencyMs ist zurueck — dieses Programm misst keine Latenz",
        voll.every((s) => s.latencyMs === undefined));
    }
  } finally {
    console.log = echtesLog;
    console.warn = echtesWarn;
    delete global.__price_cache__;
  }

  // ── Teil 7: der Zustand liegt wirklich auf `global` ────────────────────
  //
  // Teil 1 prüft die Wirkung. Diese Prüfung nagelt zusätzlich die Bauform
  // fest, damit ein Umbau auf modul-scoped nicht nur an einer Zahl auffällt.
  const cacheQuelle = ohneKommentareUndTexte(read(`frontend/${PFAD_CACHE}`));
  pruefe1("der Cache-Zustand liegt nicht mehr auf global",
    /global\.__price_cache__/.test(cacheQuelle));
  pruefe1("es gibt wieder einen modul-scoped Speicher (private/let Map)",
    !/(private\s+\w+\s*=\s*new Map|^\s*(?:const|let)\s+\w+\s*=\s*new Map)/m.test(cacheQuelle));

  // ── Teil 8: die Verdrahtung ist echt ───────────────────────────────────
  //
  // Eine tadellose Funktion nützt nichts, wenn niemand sie ruft — genau das
  // war der Zustand bis zum 26.08. Kommentare und Zeichenketten sind entfernt:
  // `preiseUebernehmen` steht auch in Erklärungen.
  const orch = ohneKommentareUndTexte(read("frontend/lib/agents/orchestrator-agent.ts"));
  pruefe1("der Handelszyklus fuellt den Preis-Cache nicht mehr",
    /preiseUebernehmen\s*\(\s*supplemented\s*\)/.test(orch));
  pruefe1("der Import des Schreibers fehlt",
    /import\(\s*\)/.test(orch) === false
      ? /preiseUebernehmen\s*\}\s*=\s*await import/.test(orch)
      : true);
  // Der Aufruf MUSS hinter dem Aufbau von `supplemented` stehen und darf den
  // Rückgabewert nicht ersetzen — sonst bekäme der Handel plötzlich Cache-Daten.
  pruefe1("fetchMarkets gibt nicht mehr `supplemented` zurueck",
    /return\s+supplemented\s*;/.test(orch));
  pruefe1("der Cache-Aufruf steht nicht in try/catch — ein Fehler dort wuerde "
    + "den Handelszyklus stoeren",
    /try\s*\{[^}]*preiseUebernehmen[\s\S]{0,400}?\}\s*catch/.test(orch));

  const mgr = ohneKommentareUndTexte(read("frontend/lib/market-data-engine/market-data-manager.ts"));
  pruefe1("isReady() ist wieder bedingungslos true",
    !/isReady\s*\(\s*\)\s*\{\s*return\s+true\s*;?\s*\}/.test(mgr));
  pruefe1("isReady() prueft nicht den Cache-Inhalt",
    /isReady\s*\(\s*\)\s*\{[\s\S]{0,200}?priceCache\.getAll\(\)\.length/.test(mgr));

  return {
    titel: `Preis-Cache (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
