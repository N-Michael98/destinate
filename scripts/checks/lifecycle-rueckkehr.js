// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 15: Rückkehr des Python-Lifecycle — FÜHRT DIE ENTSCHEIDUNG WIRKLICH AUS
//
// DER FUND (18.08.). `_trades` im Python-Lifecycle liegt ausschliesslich im
// Arbeitsspeicher (trade_lifecycle_manager.py:131) und wurde NUR beim Eröffnen
// gefüllt (orchestrator-agent.ts). Nach jedem Neustart des Dienstes — also nach
// jedem Deploy — kannte er die offenen Positionen nicht mehr:
// `on_price_update` antwortete still mit {"action": null}, während die
// Schleife weiter "[py-lifecycle] N Positionen für Lifecycle-Update" meldete.
// Das Log sah gesund aus, die zweite Schutzschicht war weg.
//
// Zweiter Teil desselben Fundes: `pyCloseTrade()` existierte seit jeher OHNE
// EINEN EINZIGEN AUFRUFER. `_trades` wurde damit nie geleert — ein Eintrag je
// jemals eröffnetem Trade blieb liegen, `open_trades` zählte falsch.
//
// WARUM DAS HIER GERECHNET WIRD. Blindes Nachregistrieren wäre schlimmer als
// gar keines: `register_trade()` ÜBERSCHREIBT den Eintrag und feuert
// TRADE_OPENED. Jeder Zyklus würde `be_set`, `partial_done` und `trail_sl`
// zurücksetzen und alle zwei Minuten eine Telegram-Meldung auslösen. Und wird
// der Handelsstil geraten statt gelesen, schliesst der Zeit-Exit einen
// SWING-Trade nach 24 statt nach 168 Stunden — 144 Stunden zu früh, am
// offenen Geld.
//
// Ein struktureller Blick ("steht der Aufruf da?") würde all das nicht sehen.
// Ein vertauschtes `has()`, ein fehlender Null-Fall oder ein Standardwert
// statt eines Übersprungs bliebe unauffällig. Deshalb werden
// nachzuregistrieren() und stammdatenAusNotizen() ECHT aufgerufen.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { ROOT, ladeTsModul } = require("./_lib");

function ladeRiskAgent(funde) {
  const tsPfad = path.join(ROOT, "frontend", "node_modules", "typescript");
  if (!fs.existsSync(tsPfad)) {
    funde.push("typescript nicht gefunden — nachholen: cd frontend && npm install");
    return null;
  }
  const ts = require(tsPfad);
  const datei = path.join(ROOT, "frontend", "lib", "agents", "risk-agent.ts");
  const js = ts.transpileModule(fs.readFileSync(datei, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modul = { exports: {} };
  const stellvertreter = () => new Proxy(function () {}, {
    get: (_z, prop) => (prop === "then" || typeof prop === "symbol" ? undefined : stellvertreter()),
    apply: () => { throw new Error("keine Aussenwelt im Prüfstand"); },
    construct: () => ({}),
  });
  try {
    new Function("exports", "require", "module", "__filename", "__dirname", js)(
      modul.exports, stellvertreter, modul, datei, path.dirname(datei));
  } catch (e) {
    funde.push(`risk-agent.ts liess sich nicht ausführen: ${e.message}`);
    return null;
  }
  return modul.exports;
}

const lies = (...teile) => {
  const p = path.join(ROOT, ...teile);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
};

/**
 * Entfernt Kommentare und Zeichenketten.
 *
 * NOTWENDIG, NICHT KOSMETISCH. Im Sabotage-Lauf am 18.08. rutschte genau eine
 * Sabotage durch: der echte Aufruf `await pyCloseTrade(...)` wurde entfernt,
 * der Prüfer blieb grün — weil der Kommentar ÜBER der Funktion die Zeichenfolge
 * `pyCloseTrade()` enthält (er beschreibt, dass sie früher keinen Aufrufer
 * hatte). Dieselbe Fehlerklasse hat uns 2026 schon fünfmal erwischt:
 * "kommt das Wort vor" statt "wird es benutzt".
 */
function ohneKommentareUndTexte(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")   // /* ... */ und /** ... */
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")  // // ... (kein Treffer in http://)
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``")
    .replace(/"(?:\\.|[^\\"])*"/g, '""')
    .replace(/'(?:\\.|[^\\'])*'/g, "''");
}

/**
 * Entfernt NUR Kommentare, lässt Zeichenketten stehen.
 *
 * Gebraucht dort, wo der Beleg selbst in einer Zeichenkette steht — etwa
 * `befund.mitStil` innerhalb einer Log-Zeile. Die schärfere Variante oben
 * würde ihn mitlöschen und einen vorhandenen Riegel als fehlend melden (genau
 * das passierte am 19.08. beim ersten Lauf dieser Prüfung).
 */
function ohneKommentare(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Schneidet den Rumpf EINER Funktion heraus.
 *
 * NOTWENDIG, NICHT KOSMETISCH. Im Sabotage-Lauf am 19.08. rutschte eine
 * Sabotage durch: die Warnung beim Löschen eines offenen Trades wurde
 * entfernt, der Prüfer blieb grün — weil `status === "OPEN"` auf derselben
 * Seite an einem Dutzend anderer Stellen steht (Filter, Anzeige, Zählung).
 * Wer prüft, ob eine BESTIMMTE Funktion etwas tut, muss in ihr suchen und
 * nicht in der ganzen Datei. Siebtes Auftreten derselben Fehlerklasse.
 */
function funktionsRumpf(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const rest = text.slice(start);
  // bis zur nächsten Funktion auf derselben Einrückungsebene
  const ende = rest.slice(1).search(/\n {0,2}(async )?function /);
  return ende < 0 ? rest : rest.slice(0, ende + 1);
}

/** Zählt echte AUFRUFE `name(` und lässt Definitionen sowie Importe weg. */
function aufrufe(rohText, name) {
  const text = ohneKommentareUndTexte(rohText);
  let n = 0;
  const re = new RegExp(`\\b${name}\\s*\\(`, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const davor = text.slice(Math.max(0, m.index - 60), m.index);
    if (/\b(function|const|let|var)\s+$/.test(davor)) continue;   // Definition
    if (/async\s+function\s+$/.test(davor)) continue;             // Definition
    if (/\bimport\s*\{[^}]*$/.test(davor)) continue;              // Import
    n++;
  }
  return n;
}

module.exports = function pruefe() {
  const funde = [];
  const m = ladeRiskAgent(funde);
  if (!m) return { titel: "Lifecycle-Rückkehr (nicht ausführbar)", funde };

  const nachzu = m.nachzuregistrieren;
  const stammAus = m.stammdatenAusNotizen;
  if (typeof nachzu !== "function") {
    funde.push("nachzuregistrieren wird nicht exportiert — die Rückkehr des "
      + "Python-Lifecycle bleibt ungeprüft");
  }
  if (typeof stammAus !== "function") {
    funde.push("stammdatenAusNotizen wird nicht exportiert — Stil und Confidence "
      + "bleiben ungeprüft");
  }
  if (funde.length) return { titel: "Lifecycle-Rückkehr (nicht ausführbar)", funde };

  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  // ── Teil 1: stammdatenAusNotizen() wirklich rechnen ───────────────────────
  const z = (o) => ({ notes: JSON.stringify(o) });

  let k = stammAus([z({ dealId: "D1", tradingStyle: "SWING", confidence: 82 })]);
  pruefe1("gültige Notiz ergibt einen Eintrag", k.size === 1);
  pruefe1("Handelsstil wird übernommen", k.get("D1") && k.get("D1").tradingStyle === "SWING");
  pruefe1("Confidence wird übernommen", k.get("D1") && k.get("D1").confidence === 82);

  pruefe1("ohne dealId kein Eintrag",
    stammAus([z({ tradingStyle: "SWING", confidence: 82 })]).size === 0);
  pruefe1("ohne Handelsstil kein Eintrag — sonst würde der Zeit-Exit geraten",
    stammAus([z({ dealId: "D1", confidence: 82 })]).size === 0);
  pruefe1("leerer Handelsstil zählt nicht",
    stammAus([z({ dealId: "D1", tradingStyle: "   ", confidence: 82 })]).size === 0);
  pruefe1("ohne Confidence kein Eintrag — sonst würde der Breakeven geraten",
    stammAus([z({ dealId: "D1", tradingStyle: "SWING" })]).size === 0);
  pruefe1("confidence null zählt NICHT (Number(null) wäre 0)",
    stammAus([z({ dealId: "D1", tradingStyle: "SWING", confidence: null })]).size === 0);
  pruefe1("confidence als Text zählt nicht",
    stammAus([z({ dealId: "D1", tradingStyle: "SWING", confidence: "82" })]).size === 0);
  pruefe1("confidence 0 ist gültig",
    stammAus([z({ dealId: "D1", tradingStyle: "SWING", confidence: 0 })]).size === 1);

  const gemischt = stammAus([
    { notes: "{kaputt" },
    z({ dealId: "D2", tradingStyle: "DAYTRADING", confidence: 75 }),
    { notes: null },
  ]);
  pruefe1("eine kaputte Notiz nimmt die übrigen nicht mit", gemischt.size === 1);
  pruefe1("leere Liste ergibt leere Karte", stammAus([]).size === 0);
  pruefe1("null ergibt leere Karte", stammAus(null).size === 0);

  // ── Teil 1b: notizenBefund() wirklich rechnen (19.08.) ───────────────────
  // In Produktion stand "Stammdaten fuer 0" — und die Zeile konnte nicht
  // sagen, ob die Abfrage nichts fand oder ob ein Feld fehlte.
  const befundF = m.notizenBefund;
  if (typeof befundF !== "function") {
    funde.push("notizenBefund wird nicht exportiert — die Ursache fehlender "
      + "Stammdaten bliebe im Dunkeln");
  } else {
    const b0 = befundF([]);
    pruefe1("leere Liste ergibt lauter Nullen",
      b0.zeilen === 0 && b0.lesbar === 0 && b0.mitDealId === 0
      && b0.mitStil === 0 && b0.mitConfidence === 0);
    pruefe1("null ergibt lauter Nullen", befundF(null).zeilen === 0);

    const b1 = befundF([
      z({ dealId: "D1", tradingStyle: "SWING", confidence: 82 }),
      z({ dealId: "D2", tradingStyle: "SWING" }),          // Confidence fehlt
      z({ dealId: "D3", confidence: 70 }),                 // Stil fehlt
      z({ tradingStyle: "SWING", confidence: 70 }),        // dealId fehlt
      { notes: "{kaputt" },                                // unlesbar
      { notes: null },                                     // leer
    ]);
    pruefe1("alle Zeilen werden gezählt", b1.zeilen === 6, String(b1.zeilen));
    pruefe1("nur lesbare zählen als lesbar", b1.lesbar === 4, String(b1.lesbar));
    pruefe1("dealId wird richtig gezählt", b1.mitDealId === 3, String(b1.mitDealId));
    pruefe1("Stil wird richtig gezählt", b1.mitStil === 3, String(b1.mitStil));
    pruefe1("Confidence wird richtig gezählt", b1.mitConfidence === 3,
      String(b1.mitConfidence));
    pruefe1("leerer Stil zählt nicht als vorhanden",
      befundF([z({ dealId: "D1", tradingStyle: "  ", confidence: 1 })]).mitStil === 0);
    pruefe1("confidence null zählt nicht als vorhanden",
      befundF([z({ dealId: "D1", tradingStyle: "S", confidence: null })]).mitConfidence === 0);

    let geworfenB = false;
    try { befundF([{ notes: 42 }, {}, null]); } catch { geworfenB = true; }
    pruefe1("notizenBefund wirft bei Unsinn — das würde den Zyklus abbrechen",
      !geworfenB);

    // ── Order-Referenz und Versuchszahl (01.09.) ─────────────────────────
    //
    // ANLASS. Am 01.09. stand im Log "4 Zeilen, 4 lesbar, 0 mit dealId,
    // 4 mit Stil, 4 mit Confidence" bei FÜNF offenen Positionen. Damit liess
    // sich nicht sagen, WARUM keine dealId da ist:
    //
    //   keine Order-Referenz  -> die Bestätigung des Brokers gab nie eine her,
    //                            es ist nichts aufzulösen, der Eintrag bleibt
    //                            für immer ohne ID
    //   Referenz vorhanden    -> der Nachtrag kommt nicht durch. Dann sagt die
    //                            Versuchszahl, ob noch gefragt wird oder ob
    //                            nach DEALID_VERSUCHE_MAX aufgegeben wurde —
    //                            aufgegebene Zeilen überspringt
    //                            `ergaenzeFehlendeDealIds` mit `continue`,
    //                            BEVOR irgendetwas gezählt oder geloggt wird.
    //
    // Zwei ganz verschiedene Ursachen, im Log bisher ununterscheidbar.
    pruefe1("mitDealReference fehlt — die Ursache fehlender dealIds bleibt offen",
      typeof b0.mitDealReference === "number");
    pruefe1("maxVersuche fehlt — aufgegebene Einträge bleiben unsichtbar",
      typeof b0.maxVersuche === "number");

    const b2 = befundF([
      z({ dealReference: "REF-1", tradingStyle: "SWING", confidence: 70 }),
      z({ dealReference: "REF-2", tradingStyle: "SWING", confidence: 70, dealIdVersuche: 5 }),
      z({ dealReference: "   ", tradingStyle: "SWING", confidence: 70 }),  // leer
      z({ tradingStyle: "SWING", confidence: 70 }),                        // gar keine
      z({ dealId: "D9", tradingStyle: "SWING", confidence: 70, dealIdVersuche: 2 }),
    ]);
    pruefe1("Order-Referenz wird gezählt", b2.mitDealReference === 2,
      String(b2.mitDealReference));
    pruefe1("leere Order-Referenz zählt als vorhanden",
      befundF([z({ dealReference: "  " })]).mitDealReference === 0);
    pruefe1("die höchste Versuchszahl wird gemeldet", b2.maxVersuche === 5,
      String(b2.maxVersuche));
    pruefe1("ohne Versuchsfeld bleibt die Zahl 0",
      befundF([z({ dealReference: "R" })]).maxVersuche === 0);
    // Text ohne Zahlwert ergibt NaN, und `NaN > 0` ist false — der Wert kann
    // das Maximum also ohnehin nicht anheben. Diese Zeile hält das fest,
    // unterscheidet aber NICHT, ob der Number.isFinite-Wächter noch dasteht.
    pruefe1("unsinnige Versuchszahl verfälscht das Maximum",
      befundF([z({ dealReference: "R", dealIdVersuche: "viele" })]).maxVersuche === 0);
    // DAS hier unterscheidet ihn. Im Sabotage-Lauf vom 01.09. rutschte
    // "Number.isFinite entfernt" zuerst durch, weil oben nur NaN geprüft
    // wurde. `Number("1e999")` ergibt Infinity, und `Infinity > 0` ist WAHR —
    // ohne den Wächter stünde im Log "höchste Versuchszahl Infinity".
    // JSON kennt kein Infinity, über eine Zeichenkette kommt es aber hinein.
    pruefe1("Infinity als Versuchszahl kommt durch — der Wächter fehlt",
      befundF([z({ dealReference: "R", dealIdVersuche: "1e999" })]).maxVersuche === 0,
      String(befundF([z({ dealReference: "R", dealIdVersuche: "1e999" })]).maxVersuche));
  }

  // ── Teil 1c: geratenerStilMelden() wirklich rechnen (19.08.) ─────────────
  // Ohne Datenbankzeile UND ohne Speicher raet der RiskAgent Stil und
  // Confidence. Das entscheidet ueber den Zeit-Exit (24 h statt 168 h) und
  // darf nicht stumm passieren — aber auch nicht alle zwei Minuten schreien.
  const melden = m.geratenerStilMelden;
  const resetGeraten = m.resetGerateneStammdaten;
  if (typeof melden !== "function" || typeof resetGeraten !== "function") {
    funde.push("geratenerStilMelden/resetGerateneStammdaten werden nicht "
      + "exportiert — ein geratener Handelsstil bliebe unsichtbar");
  } else {
    resetGeraten();
    pruefe1("mit Datenbankzeile wird faelschlich gemeldet",
      melden("D1", true, false) === false);
    pruefe1("mit Speicher-Eintrag wird faelschlich gemeldet",
      melden("D1", false, true) === false);
    pruefe1("mit beidem wird faelschlich gemeldet",
      melden("D1", true, true) === false);
    pruefe1("ohne dealId wird gemeldet", melden("", false, false) === false);
    pruefe1("ohne jede Quelle wird NICHT gemeldet",
      melden("D1", false, false) === true,
      "der geratene Stil bliebe unsichtbar");
    pruefe1("dieselbe Position wird ein ZWEITES Mal gemeldet",
      melden("D1", false, false) === false,
      "sonst alle zwei Minuten dieselbe Warnung");
    pruefe1("eine ANDERE Position wird nicht gemeldet",
      melden("D2", false, false) === true);
    resetGeraten();
    pruefe1("nach dem Zuruecksetzen wird nicht wieder gemeldet",
      melden("D1", false, false) === true);

    // Aufräumen geschlossener Positionen (19.08.) — sonst wächst die Menge
    // unbegrenzt, und eine wiederkehrende dealId bliebe stumm.
    const vergiss = m.vergissGemeldete;
    if (typeof vergiss !== "function") {
      funde.push("vergissGemeldete wird nicht exportiert — die Merker-Menge "
        + "wüchse mit jeder je gesehenen Position weiter");
    } else {
      resetGeraten();
      melden("D1", false, false);
      melden("alter:D1", false, false);
      melden("D2", false, false);
      vergiss(new Set(["D1"]));
      pruefe1("der Merker einer noch offenen Position wird gelöscht",
        melden("D1", false, false) === false);
      pruefe1("auch der Merker mit Präfix bleibt bei offener Position",
        melden("alter:D1", false, false) === false);
      pruefe1("der Merker einer geschlossenen Position bleibt liegen",
        melden("D2", false, false) === true,
        "danach würde dieselbe Position nie wieder gemeldet");
      vergiss(new Set());
      pruefe1("eine leere Live-Menge räumt nicht alles ab",
        melden("D1", false, false) === true);
    }
    resetGeraten();
  }

  // ── Teil 2: nachzuregistrieren() wirklich rechnen ─────────────────────────
  const POS = {
    dealId: "D1", symbol: "EURUSD", epic: "EURUSD", direction: "BUY",
    size: 1000, openLevel: 1.1, stopLevel: 1.09, profitLevel: 1.12,
    createdDate: "2026-08-17T10:00:00.000Z",
  };
  const STAMM = new Map([["D1", { tradingStyle: "SWING", confidence: 82 }]]);
  const pos = (ueber) => [{ ...POS, ...ueber }];

  // FAIL-SAFE: Abfrage fehlgeschlagen -> NICHTS registrieren
  pruefe1("bekannt=null registriert NICHTS (Abfrage fehlgeschlagen)",
    nachzu(pos({}), null, STAMM).length === 0,
    "sonst würden be_set/partial_done/trail_sl auf laufenden Positionen zurückgesetzt");
  pruefe1("bekannt=undefined registriert NICHTS",
    nachzu(pos({}), undefined, STAMM).length === 0);

  const leer = new Set();
  const eins = nachzu(pos({}), leer, STAMM);
  pruefe1("unbekannte Position wird nachgereicht", eins.length === 1);
  if (eins.length === 1) {
    const t = eins[0];
    pruefe1("tradeId ist die dealId", t.tradeId === "D1");
    pruefe1("Einstieg kommt vom Broker (openLevel)", t.entry === 1.1);
    pruefe1("Stop kommt vom LIVE-Stand (stopLevel), nicht aus der Datenbank",
      t.stopLoss === 1.09);
    pruefe1("Ziel kommt vom Broker (profitLevel)", t.takeProfit === 1.12);
    pruefe1("Grösse kommt vom Broker", t.size === 1000);
    pruefe1("Handelsstil kommt aus den Stammdaten", t.tradingStyle === "SWING");
    pruefe1("Confidence kommt aus den Stammdaten", t.confidence === 82);
    pruefe1("Broker ist Capital.com", t.broker === "Capital.com");
    pruefe1("Eröffnungszeit ist die ECHTE (createdDate), nicht jetzt",
      t.openedAt === "2026-08-17T10:00:00.000Z",
      "sonst zählt der Zeit-Exit ab null und hält die Position zu lange");
    pruefe1("nachgereicht wird STILL (silent)", t.silent === true,
      "register_trade() feuert sonst TRADE_OPENED und Telegram meldet nach "
      + "jedem Deploy 'Trade ausgeführt' für längst laufende Positionen");
  }

  pruefe1("bereits bekannte Position wird NICHT überschrieben",
    nachzu(pos({}), new Set(["D1"]), STAMM).length === 0,
    "register_trade() überschreibt und feuert TRADE_OPENED");
  pruefe1("ohne Stammdaten wird NICHT registriert",
    nachzu(pos({}), leer, new Map()).length === 0,
    "Stil und Confidence dürfen nicht geraten werden");
  pruefe1("stammdaten=null registriert nichts",
    nachzu(pos({}), leer, null).length === 0);
  pruefe1("ohne dealId wird nichts registriert",
    nachzu(pos({ dealId: "" }), leer, STAMM).length === 0);

  // Richtung
  pruefe1("unbekannte Richtung wird übersprungen",
    nachzu(pos({ direction: "LONG" }), leer, STAMM).length === 0);
  pruefe1("fehlende Richtung wird übersprungen",
    nachzu(pos({ direction: null }), leer, STAMM).length === 0);
  const klein = nachzu(pos({ direction: "sell" }), leer, STAMM);
  pruefe1("Kleinschreibung wird erkannt", klein.length === 1);
  pruefe1("Richtung wird normalisiert", klein.length === 1 && klein[0].direction === "SELL");

  // Einstieg und Grösse
  pruefe1("Einstieg 0 wird übersprungen",
    nachzu(pos({ openLevel: 0 }), leer, STAMM).length === 0);
  pruefe1("Einstieg negativ wird übersprungen",
    nachzu(pos({ openLevel: -1 }), leer, STAMM).length === 0);
  pruefe1("Einstieg unlesbar wird übersprungen",
    nachzu(pos({ openLevel: "abc" }), leer, STAMM).length === 0);
  pruefe1("Grösse 0 wird übersprungen",
    nachzu(pos({ size: 0 }), leer, STAMM).length === 0);
  pruefe1("Grösse unlesbar wird übersprungen",
    nachzu(pos({ size: null }), leer, STAMM).length === 0);

  // Eröffnungszeit
  pruefe1("ohne Eröffnungszeit wird NICHT registriert",
    nachzu(pos({ createdDate: "" }), leer, STAMM).length === 0,
    "der Zeit-Exit würde sonst ab jetzt zählen");
  pruefe1("unlesbare Eröffnungszeit wird NICHT registriert",
    nachzu(pos({ createdDate: "quatsch" }), leer, STAMM).length === 0);
  pruefe1("fehlende Eröffnungszeit wird NICHT registriert",
    nachzu(pos({ createdDate: null }), leer, STAMM).length === 0);

  // Stop/Ziel fehlen — Python hat dafür einen Rückfall, registriert wird trotzdem
  const ohneStop = nachzu(pos({ stopLevel: null, profitLevel: null }), leer, STAMM);
  pruefe1("Position ohne Stop wird trotzdem registriert (Zeit-Exit gilt weiter)",
    ohneStop.length === 1);
  pruefe1("fehlender Stop wird als 0 übergeben",
    ohneStop.length === 1 && ohneStop[0].stopLoss === 0);
  pruefe1("fehlendes Ziel wird als 0 übergeben",
    ohneStop.length === 1 && ohneStop[0].takeProfit === 0);

  // Symbol-Rückfall und Mengenlogik
  const nurEpic = nachzu(pos({ symbol: null }), leer, STAMM);
  pruefe1("Symbol fällt auf epic zurück",
    nurEpic.length === 1 && nurEpic[0].symbol === "EURUSD");
  pruefe1("leere Positionsliste ergibt nichts", nachzu([], leer, STAMM).length === 0);
  pruefe1("null-Positionsliste ergibt nichts", nachzu(null, leer, STAMM).length === 0);

  const viele = nachzu(
    [POS, { ...POS, dealId: "D2" }, { ...POS, dealId: "D3" }],
    new Set(["D2"]),
    new Map([["D1", { tradingStyle: "SWING", confidence: 82 }],
             ["D3", { tradingStyle: "SCALPING", confidence: 71 }]]),
  );
  pruefe1("aus drei Positionen bleiben die zwei fehlenden", viele.length === 2);
  pruefe1("die bekannte ist nicht dabei", !viele.some((t) => t.tradeId === "D2"));
  pruefe1("je Position eigener Stil",
    viele.length === 2 && viele.find((t) => t.tradeId === "D3")
    && viele.find((t) => t.tradeId === "D3").tradingStyle === "SCALPING");

  // ── Teil 3: ist die Entscheidung auch VERDRAHTET? ─────────────────────────
  // Nicht "kommt das Wort vor", sondern: wird es wirklich aufgerufen.
  const instr = lies("frontend", "instrumentation.ts");
  const client = lies("frontend", "lib", "python-backend", "python-client.ts");
  const tracker = lies("frontend", "lib", "capital-com", "capital-trade-tracker.ts");
  // Auch die Muster-Prüfungen laufen auf dem bereinigten Text — sonst könnte
  // ein Kommentar eine Verdrahtung vortäuschen, die es nicht gibt.
  const instrC = ohneKommentareUndTexte(instr);
  const clientC = ohneKommentareUndTexte(client);

  pruefe1("instrumentation.ts ruft nachzuregistrieren() auf",
    aufrufe(instr, "nachzuregistrieren") >= 1);
  pruefe1("instrumentation.ts holt die bekannten Trades",
    aufrufe(instr, "pyLifecycleTrades") >= 1,
    "ohne diese Liste wäre jedes Registrieren ein Überschreiben");
  pruefe1("instrumentation.ts registriert wirklich nach",
    aufrufe(instr, "pyRegisterTrade") >= 1);
  pruefe1("instrumentation.ts liest die Stammdaten",
    aufrufe(instr, "stammdatenAusNotizen") >= 1);
  const riskRoh = lies("frontend", "lib", "agents", "risk-agent.ts");
  pruefe1("der RiskAgent meldet einen geratenen Stil nicht",
    aufrufe(riskRoh, "geratenerStilMelden") >= 1,
    "aufrufe() laesst die Definition bewusst weg — gezaehlt wird die echte "
    + "Aufrufstelle in der Positions-Schleife");
  pruefe1("die Meldung haengt nicht am fehlenden Speicher-Eintrag",
    /geratenerStilMelden\(pos\.dealId,\s*!!dbEntry,\s*hatSpeicher\)/
      .test(ohneKommentare(riskRoh)),
    "beide Quellen muessen fehlen, sonst warnt es bei jedem neuen Trade");
  pruefe1("die Meldung nennt die Folge für den Zeit-Exit nicht",
    /STYLE_MAX_HOURS\[mem\.tradingStyle/.test(ohneKommentare(riskRoh)),
    "ohne die Stundenzahl weiss niemand, was der geratene Stil kostet");

  pruefe1("instrumentation.ts ermittelt die Ursache fehlender Stammdaten nicht",
    aufrufe(instr, "notizenBefund") >= 1
    && /befund\.zeilen/.test(ohneKommentare(instr))
    && /befund\.mitStil/.test(ohneKommentare(instr)),
    "sonst sieht 'keine offenen Trades' aus wie 'Feld fehlt in den Notizen'");

  // ── Die neuen Werte muessen auch im LOG landen (01.09.) ─────────────────
  //
  // Eine Zaehlung, die niemand ausgibt, ist so gut wie keine. Genau das war
  // bei der Bilanz von ergaenzeFehlendeDealIds der Fall: die Funktion rechnet
  // {geprueft, ergaenzt, aufgegeben} aus, und der Aufrufer verwarf sie.
  pruefe1("die Order-Referenz steht nicht in der Meldung — dann bleibt offen, "
    + "ob es ueberhaupt etwas aufzuloesen gibt",
    /befund\.mitDealReference/.test(ohneKommentare(instr)));
  pruefe1("die Versuchszahl steht nicht in der Meldung — aufgegebene Eintraege "
    + "bleiben unsichtbar",
    /befund\.maxVersuche/.test(ohneKommentare(instr)));

  pruefe1("das Ergebnis von nachzuregistrieren wird auch benutzt",
    /const\s+fehlend\s*=\s*nachzuregistrieren\(/.test(instrC)
    && /for\s*\(const\s+\w+\s+of\s+fehlend\)/.test(instrC),
    "sonst würde die Liste berechnet und weggeworfen");

  pruefe1("python-client.ts exportiert pyLifecycleTrades",
    /export\s+async\s+function\s+pyLifecycleTrades/.test(clientC));
  pruefe1("pyLifecycleTrades meldet Fehler als null, nicht als leere Menge",
    /if\s*\(!res\s*\|\|\s*!Array\.isArray\(res\.trades\)\)\s*return\s+null;/.test(clientC),
    "ein leeres Set würde bei jedem Ausfall ALLES überschreiben");

  pruefe1("python-client.ts reicht das stille Flag durch",
    /silent:\s*params\.silent === true,/.test(clientC),
    "ohne Durchreichen bleibt silent im Backend immer false");

  const lifecyclePy = lies("backend", "api", "routes", "lifecycle.py");
  const managerPy = lies("backend", "services", "trade_lifecycle_manager.py");
  pruefe1("die Route nimmt silent entgegen", /silent:\s*bool\s*=\s*False/.test(lifecyclePy));
  pruefe1("die Route reicht silent an den Manager weiter",
    /register_trade\(trade,\s*silent=body\.silent\)/.test(lifecyclePy));
  pruefe1("der Manager unterdrückt TRADE_OPENED bei silent",
    /if\s+silent:[\s\S]{0,260}?return/.test(managerPy),
    "sonst meldet Telegram jede nachgereichte Position als neuen Trade");

  pruefe1("pyCloseTrade hat einen Aufrufer",
    aufrufe(tracker, "pyCloseTrade") >= 1,
    "ohne ihn wird _trades im Python-Lifecycle nie geleert");
  pruefe1("beide Schliess-Pfade melden an Python",
    aufrufe(tracker, "meldeSchliessungAnPython") >= 2,
    "Phantom-/KEIN_PNL-Pfad und der echte Abschluss");

  // ── Teil 6: niemand darf OFFENE Trades massenhaft löschen (19.08.) ───────
  //
  // Am 19.08. standen vier offene Positionen beim Broker und NULL passende
  // Zeilen in der Datenbank. Der wahrscheinliche Weg dorthin: der Knopf
  // "Journal zurücksetzen" rief prisma.trade.deleteMany() OHNE Filter — und
  // der Bestätigungstext sprach von einer "SQLite-Datenbank", während in
  // Produktion PostgreSQL läuft.
  //
  // Die Zeile eines offenen Trades ist die einzige Verbindung zur laufenden
  // Position: ohne sie fällt der RiskAgent auf geratene Werte zurück, der
  // Risiko-Zustand wird nicht mehr gespeichert und der Python-Lifecycle kann
  // nicht nachregistrieren. Dieselbe Fehlerklasse wie am 17.08.
  const tradesRoute = lies("frontend", "app", "api", "trades", "route.ts");
  const tradesC = ohneKommentare(tradesRoute);
  pruefe1("die Route /api/trades fehlt", tradesRoute.length > 0);
  pruefe1("deleteMany() löscht wieder ALLES, auch offene Trades",
    !/deleteMany\(\s*\)/.test(tradesC),
    "ein Filter auf status ist Pflicht");
  pruefe1("deleteMany() nimmt offene Trades nicht aus",
    /deleteMany\(\{[\s\S]{0,120}status:\s*\{\s*not:\s*["']OPEN["']\s*\}/.test(tradesC),
    "sonst reisst ein Knopfdruck die Verbindung zu laufenden Positionen durch");
  pruefe1("die Antwort sagt nicht, wie viele offene behalten wurden",
    /offenBehalten/.test(tradesC));

  const journalSeite = lies("frontend", "app", "trading-journal", "page.tsx");
  pruefe1("der Bestätigungstext behauptet weiter SQLite",
    !/SQLite/i.test(ohneKommentare(journalSeite)),
    "in Produktion läuft PostgreSQL — der Text verharmlost den Eingriff");
  // IN der Funktion suchen, nicht in der ganzen Seite: `status === "OPEN"`
  // steht dort an einem Dutzend anderer Stellen (Filter, Anzeige, Zählung).
  const loeschRumpf = funktionsRumpf(ohneKommentare(journalSeite), "deleteTrade");
  pruefe1("deleteTrade() ist nicht auffindbar", loeschRumpf.length > 0);
  pruefe1("beim Löschen einer einzelnen Zeile wird der OPEN-Fall nicht benannt",
    /status === ["']OPEN["']/.test(loeschRumpf),
    "ein offener Trade ist die einzige Verbindung zur laufenden Position");
  pruefe1("der Status erreicht deleteTrade gar nicht",
    /deleteTrade\(trade\.id,\s*trade\.status\)/.test(ohneKommentare(journalSeite)),
    "ohne ihn kann die Rückfrage den OPEN-Fall nicht erkennen");

  // ── Teil 7: dealId und dealReference sind zwei Dinge (19.08.) ───────────
  //
  // Am 19.08. trugen ALLE Journal-Einträge `o_...` — Order-Referenzen, weil
  // der Bestätigungsschritt fehlgeschlagen war und die Referenz ersatzweise
  // als dealId gespeichert wurde. Die laufenden Positionen tragen
  // `00000000-...`. Zwei Namensräume, die nie zusammenfinden: persistMeta,
  // teilgewinnStand, stammdatenAusNotizen und nachzuregistrieren greifen für
  // solche Trades DAUERHAFT ins Leere, ohne ein Wort.
  const trackerRoh = lies("frontend", "lib", "capital-com", "capital-trade-tracker.ts");
  const trackerC = ohneKommentare(trackerRoh);

  pruefe1("die Bilanz von ergaenzeFehlendeDealIds wird verworfen statt gemeldet",
    /=\s*await ergaenzeFehlendeDealIds\(/.test(trackerC),
    "der Rueckgabewert {geprueft, ergaenzt, aufgegeben} wird nicht einmal gelesen");
  pruefe1("die Bilanz wird gelesen, aber nicht ausgegeben",
    /dealId-Nachtrag/.test(trackerRoh),
    "ohne Logzeile ist ein stiller Nachtrag von 'nie gelaufen' nicht zu trennen");
  const orchRoh = lies("frontend", "lib", "agents", "orchestrator-agent.ts");

  pruefe1("das Journal kennt kein eigenes Feld für die Order-Referenz",
    /dealReference\?:\s*string/.test(trackerC));
  pruefe1("dealId wird auch ohne echte Positions-ID geschrieben",
    /\.\.\.\(trade\.dealId \? \{ dealId: trade\.dealId \} : \{\}\)/.test(trackerC),
    "ein leeres Feld ist ehrlicher als eine Referenz, die nie passt");
  pruefe1("die Order-Referenz landet nicht in den Notizen",
    /dealReference: trade\.dealReference/.test(trackerC),
    "ohne sie kann die echte ID später nicht nachgetragen werden");
  pruefe1("der Orchestrator schreibt wieder einen Platzhalter als dealId",
    !/dealId:\s*result\?\.dealId \?\? "unknown"/.test(ohneKommentare(orchRoh)));

  pruefe1("es gibt kein Nachtragen der Positions-ID",
    aufrufe(trackerRoh, "ergaenzeFehlendeDealIds") >= 1
    && /export async function ergaenzeFehlendeDealIds/.test(trackerRoh));
  pruefe1("das Nachtragen läuft nicht vor dem Positions-Abgleich",
    trackerC.indexOf("ergaenzeFehlendeDealIds(session.apiKey")
      < trackerC.indexOf("capitalGetPositions(session.apiKey"),
    "ein Eintrag ohne dealId sähe sonst aus wie eine verschwundene Position");
  pruefe1("das Nachtragen hat keine Obergrenze — es würde ewig weiterfragen",
    /DEALID_VERSUCHE_MAX/.test(trackerC)
    && /versuche >= DEALID_VERSUCHE_MAX/.test(trackerC));
  pruefe1("eine abgelehnte Order wird weiter abgefragt",
    /a\.abgelehnt/.test(trackerC),
    "zu ihr wird es nie eine Position geben");

  // Der Rückfall an der Quelle: ein fehlendes Eröffnungsdatum darf nicht
  // erfunden werden, sonst zählt der Zeit-Exit ab null.
  const clientRoh = lies("frontend", "lib", "capital-com", "capital-com-client.ts");
  pruefe1("ein fehlendes Eröffnungsdatum wird wieder durch JETZT ersetzt",
    !/createdDate:\s*String\(pos\.createdDate \?\? new Date\(\)/.test(ohneKommentare(clientRoh)),
    "damit läuft der Zeit-Exit für diese Position nie");
  // ── Kein Zeit-Exit auf geratenem Handelsstil (19.08.) ───────────────────
  // Der teuerste Fall: ohne Journal-Zeile steht der Stil auf DAYTRADING, also
  // 24 h. Waere die Position SWING gedacht, schloesse der Zeit-Exit sie
  // 144 Stunden zu frueh — ein Eingriff auf einer Annahme.
  const riskC = ohneKommentare(riskRoh);
  pruefe1("die Merker werden nie aufgeräumt",
    aufrufe(riskRoh, "vergissGemeldete") >= 1
    && /vergissGemeldete\(liveIds\)/.test(ohneKommentare(riskRoh)),
    "die Funktion allein genügt nicht — sie muss im Zyklus gerufen werden");

  pruefe1("PosMeta merkt sich nicht, ob der Stil geraten ist",
    /stilGeraten\?:\s*boolean/.test(riskC));
  pruefe1("stilGeraten wird nicht aus beiden Quellen bestimmt",
    /stilGeraten:\s*!dbEntry && !hatSpeicher/.test(riskC),
    "nur wenn WEDER Datenbank NOCH Speicher etwas hergeben, ist es geraten");
  pruefe1("der Zeit-Exit handelt weiter auf geratenem Stil",
    /else if \(meta\.stilGeraten === true\)/.test(riskC),
    "er wuerde die Position auf einer Annahme schliessen");
  pruefe1("die Aussetzung greift nicht VOR dem Altersvergleich",
    riskC.indexOf("meta.stilGeraten === true") < riskC.indexOf("ageHours >= maxHours"),
    "sonst wird trotzdem geschlossen");
  pruefe1("Breakeven, Teilgewinn oder Trailing haengen faelschlich am geratenen Stil",
    (riskC.match(/stilGeraten/g) || []).length === 3,
    "genau drei Stellen: Feld, Zuweisung, Zeit-Exit — sonst ist mehr gesperrt "
    + "als beabsichtigt");

  pruefe1("der RiskAgent behandelt ein unbekanntes Alter nicht gesondert",
    /const ageHours = eroeffnet && !Number\.isNaN/.test(ohneKommentare(riskRoh))
    && /if \(ageHours == null\)/.test(ohneKommentare(riskRoh)),
    "sonst gilt eine Position ohne Datum als gerade eröffnet");

  // ── Teil 8: ein Datenbank-Ausfall darf nicht alles anhalten (19.08.) ────
  //
  // Anlass: Railway kündigte für Sa 10:00 – So 18:00 UTC einen Sicherheits-
  // Patch des Postgres an (13 CVEs, „high"). Der Patch startet die Datenbank
  // neu. Zwei Stellen hätten das teuer gemacht.
  const atm = lies("frontend", "lib", "capital-com", "active-trade-manager.ts");
  const atmC = ohneKommentare(atm);
  pruefe1("active-trade-manager.ts fehlt", atm.length > 0);
  pruefe1("die DB-Abfrage der Risiko-Verwaltung ist wieder ungeschützt",
    /let dbTrades: Array<\{ notes: string \}> = \[\];/.test(atmC)
    && /try \{[\s\S]{0,200}?dbTrades = await/.test(atmC),
    "eine geworfene Abfrage bricht runActiveTradeManager ab — dann laufen "
    + "Breakeven, Teilgewinn und Trailing für KEINE Position mehr");
  pruefe1("der Ausfall der DB-Abfrage wird verschwiegen",
    /\[trade-mgr\][^"]*Trade-Notizen nicht lesbar/.test(ohneKommentare(atm)));

  pruefe1("der Datenbank-Vorlauf hängt wieder am selben try wie die Schleifen",
    /DATENBANK-VORLAUF GESCHEITERT/.test(ohneKommentare(instr)),
    "sonst startet bei DB-Ausfall am Prozessstart KEINE Handelsschleife — "
    + "und register() läuft nur einmal, es erholt sich nie");
  pruefe1("der Start ohne Datenbank wird nicht gemeldet",
    /Datenbank beim Start nicht erreichbar/.test(instr),
    "eine console.error-Zeile allein bemerkt nachts niemand");
  // Die Schleifen MUESSEN hinter dem Auffangblock stehen, nicht davor.
  pruefe1("die Schleifen starten weiterhin vor dem Auffangblock",
    ohneKommentare(instr).indexOf("DATENBANK-VORLAUF GESCHEITERT") <
    ohneKommentare(instr).indexOf("setInterval"),
    "sonst liegen sie weiter im selben try und werden übersprungen");

  // ── Teil 9: eine Journal-Zeile darf nicht verloren gehen (20.08.) ───────
  //
  // Wenn saveCapitalTradeToJournal() gerufen wird, ist die Order beim Broker
  // BEREITS LIVE. Die Zeile ist die einzige Verbindung dorthin — ohne sie
  // rät der RiskAgent den Stil, der Zeit-Exit setzt aus, der Teilgewinn-Riegel
  // ist blind und Python kann nicht nachregistrieren. Bis zum 20.08. stand
  // dort nur ein console.error: ein Aussetzer von Sekunden kostete die Zeile
  // DAUERHAFT.
  const tr = ladeTsModul("lib/capital-com/capital-trade-tracker.ts");
  if (tr.fehler) {
    funde.push(tr.fehler);
  } else {
    const { merkeAusstehendeZeile, ausstehendeAnzahl, ausstehendeLeeren,
            AUSSTEHEND_MAX, JOURNAL_WARTEZEITEN } = tr.exports;
    if (typeof merkeAusstehendeZeile !== "function"
        || typeof ausstehendeAnzahl !== "function"
        || typeof ausstehendeLeeren !== "function") {
      funde.push("die Warteschlange für ungeschriebene Journal-Zeilen wird nicht "
        + "exportiert — sie bleibt damit ungeprüft");
    } else {
      ausstehendeLeeren();
      pruefe1("frisch ist die Warteschlange nicht leer", ausstehendeAnzahl() === 0);
      merkeAusstehendeZeile({ symbol: "EURUSD", direction: "BUY" });
      pruefe1("eine gemerkte Zeile wird nicht gezählt", ausstehendeAnzahl() === 1);
      merkeAusstehendeZeile(null);
      pruefe1("null landet fälschlich in der Warteschlange", ausstehendeAnzahl() === 1);

      // Die Obergrenze ist der Riegel gegen ein Leck: bei einem langen
      // Datenbank-Ausfall wüchse die Schlange sonst mit jedem Trade weiter.
      ausstehendeLeeren();
      for (let i = 0; i < AUSSTEHEND_MAX + 15; i++) {
        merkeAusstehendeZeile({ symbol: `S${i}`, direction: "BUY" });
      }
      pruefe1(`die Warteschlange wächst über ${AUSSTEHEND_MAX} hinaus — ein Leck`,
        ausstehendeAnzahl() === AUSSTEHEND_MAX, String(ausstehendeAnzahl()));
      ausstehendeLeeren();
      pruefe1("Leeren wirkt nicht", ausstehendeAnzahl() === 0);

      let geworfenQ = false;
      try { merkeAusstehendeZeile(undefined); ausstehendeAnzahl(); } catch { geworfenQ = true; }
      pruefe1("die Warteschlange wirft bei Unsinn — das würde den Zyklus abbrechen",
        !geworfenQ);
      pruefe1("es gibt keine Wartezeiten zwischen den Sofort-Versuchen",
        Array.isArray(JOURNAL_WARTEZEITEN) && JOURNAL_WARTEZEITEN.length >= 2
        && JOURNAL_WARTEZEITEN.every((n) => typeof n === "number" && n > 0),
        "ohne Pause wiederholt sich der Fehlschlag sofort");
      ausstehendeLeeren();
    }
  }

  const trRoh = lies("frontend", "lib", "capital-com", "capital-trade-tracker.ts");
  const trC2 = ohneKommentare(trRoh);
  pruefe1("das Schreiben wird nicht wiederholt",
    /for \(let versuch = 0; versuch <= JOURNAL_WARTEZEITEN\.length; versuch\+\+\)/.test(trC2),
    "ein einzelner Fehlversuch kostet sonst die Zeile dauerhaft");
  pruefe1("nach dem letzten Versuch wird die Zeile nicht gemerkt",
    aufrufe(trRoh, "merkeAusstehendeZeile") >= 1);
  pruefe1("die gemerkten Zeilen werden nie nachgetragen",
    aufrufe(trRoh, "schreibeAusstehendeZeilen") >= 1
    && /await schreibeAusstehendeZeilen\(\)/.test(trC2));
  pruefe1("das Nachtragen läuft nicht als ERSTES im Zyklus",
    trC2.indexOf("await schreibeAusstehendeZeilen()")
      < trC2.indexOf("await ergaenzeFehlendeDealIds("),
    "eine fehlende Zeile heisst, dass die laufende Position unbekannt ist — "
    + "alles danach setzt sie voraus");
  // Wiederholen OHNE Doppelpruefung waere schlimmer als gar nicht wiederholen:
  // ein INSERT kann landen und die Antwort verloren gehen.
  pruefe1("die Wiederholung prüft nicht auf eine bereits geschriebene Zeile",
    /versucheJournalZeile\(trade, versuch > 0\)/.test(trC2),
    "sonst entsteht bei einem Antwortverlust ein DOPPELTER Journal-Eintrag");
  pruefe1("das Nachtragen prüft nicht auf eine bereits geschriebene Zeile",
    /versucheJournalZeile\(trade, true\)/.test(trC2));
  pruefe1("die Doppelprüfung fragt die Datenbank gar nicht",
    /SELECT 1 FROM "Trade" WHERE notes LIKE \$1 LIMIT 1/.test(trRoh));
  // Das Schreiben braucht nur die Datenbank — nicht den Broker.
  pruefe1("das Nachtragen hängt an der Broker-Verbindung",
    trC2.indexOf("await schreibeAusstehendeZeilen()")
      < trC2.indexOf("if (!isCapitalConnected()) return;"),
    "bei getrennter Sitzung blieben gemerkte Zeilen sonst liegen");

  pruefe1("der Verlust einer Journal-Zeile wird nicht gemeldet",
    /Journal-Zeile konnte nicht geschrieben werden/.test(ohneKommentare(trRoh)),
    "eine laufende Position ohne Zeile darf man nicht nur im Log entdecken");

  return {
    titel: `Lifecycle-Rückkehr (${geprueft} Prüfungen, Entscheidung ausgeführt)`,
    funde,
  };
};
