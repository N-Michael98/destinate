// PRÜFT: Jeder Menüeintrag des Dashboards hat eine Ansicht — und umgekehrt.
//
// WARUM (26.08.). Das Dashboard ist kein Satz von Seiten, sondern EINE Seite
// mit einem Ansichtsumschalter: `navGroups` listet die Einträge, und weiter
// unten entscheidet eine Kette `if (activeView === "…") return <X />;`, was
// gerendert wird. Beide Listen stehen in derselben Datei, aber 3500 Zeilen
// auseinander — und sie waren auseinandergelaufen.
//
// "Live Prep" stand im Menü, ohne Render-Zeile: als einziger von 29. Der Klick
// fiel deshalb auf den Durchfall-Platzhalter und zeigte dort "Status:
// Prepared" in Grün und "Diese Ansicht ist bewusst aus dem Hauptdashboard
// ausgelagert". Beides unwahr — die Ansicht war nicht ausgelagert, es gab sie
// nicht. Im ganzen Programm existierte keine Live-Prep-Komponente.
//
// Das ist die Fehlerklasse, die dieses Repository am häufigsten getroffen hat:
// etwas sieht fertig aus, weil daneben ein grünes Wort steht.
//
// Die Gegenrichtung wird mitgeprüft: eine gerenderte Ansicht ohne Menüeintrag
// ist Code, den niemand erreichen kann.
const { read, ladeTsModul } = require("./_lib");

/** Entfernt NUR Kommentare, lässt Zeichenketten stehen — hier werden Texte in
 *  JSX und SQL geprüft, die schärfere Variante würde sie mitlöschen. */
function ohneKommentare(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SEITE = "frontend/app/page.tsx";

module.exports = function pruefe() {
  const funde = [];
  const roh = read(SEITE);

  // Kommentare raus, BEVOR gezählt wird. Ein Eintrag in einer Erklärung ist
  // kein Menüeintrag — und genau in diesem Prüfer steht der entfernte
  // "live-prep" jetzt als Kommentar direkt neben der Liste.
  const quelle = roh
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // ── Menü ────────────────────────────────────────────────────────────────
  const start = quelle.indexOf("const navGroups");
  if (start < 0) {
    return { titel: "Menü ↔ Ansichten", funde: ["navGroups nicht gefunden — umbenannt?"] };
  }
  // Bis zum Zeilenende-Semikolon des Arrays: `\n];`
  const ende = quelle.indexOf("\n];", start);
  if (ende < 0) {
    return { titel: "Menü ↔ Ansichten", funde: ["Ende von navGroups nicht gefunden"] };
  }
  const menuBlock = quelle.slice(start, ende);

  const menue = [...menuBlock.matchAll(/view:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const menueSet = new Set(menue);

  if (menue.length === 0) {
    return { titel: "Menü ↔ Ansichten", funde: ["kein einziger Menüeintrag gelesen — Muster passt nicht mehr"] };
  }

  // Doppelte Einträge: zwei Knöpfe, dieselbe Ansicht — meist ein Kopierfehler.
  const doppelt = menue.filter((v, i) => menue.indexOf(v) !== i);
  for (const d of new Set(doppelt)) {
    funde.push(`Menüeintrag "${d}" kommt mehrfach vor`);
  }

  // Jeder Eintrag braucht eine Beschriftung — ein Knopf ohne Text ist unklickbar.
  const eintraege = [...menuBlock.matchAll(/\{\s*label:\s*"([^"]+)"[^}]*view:\s*"([a-z0-9-]+)"\s*\}/g)];
  if (eintraege.length !== menue.length) {
    funde.push(
      `${menue.length} Ansichten im Menü, aber nur ${eintraege.length} mit Beschriftung — `
      + `ein Eintrag ist unvollständig`
    );
  }

  // ── Gerenderte Ansichten ────────────────────────────────────────────────
  const gerendert = new Set(
    [...quelle.matchAll(/activeView\s*===\s*"([a-z0-9-]+)"/g)].map((m) => m[1])
  );

  // Die Startansicht wird gesetzt, nicht verglichen — sie muss trotzdem im
  // Menü stehen, sonst startet das Dashboard auf einem Eintrag, den niemand
  // wieder anwählen kann.
  const start_ = quelle.match(/useState\(\s*"([a-z0-9-]+)"\s*\)[\s\S]{0,80}?activeView|activeView[^=]*=\s*useState\(\s*"([a-z0-9-]+)"/);
  const startAnsicht = start_ ? (start_[1] || start_[2]) : null;
  if (startAnsicht && !menueSet.has(startAnsicht)) {
    funde.push(
      `Startansicht "${startAnsicht}" steht nicht im Menü — sie lässt sich nach `
      + `einem Wechsel nicht wieder anwählen`
    );
  }

  // ── Der eigentliche Abgleich ────────────────────────────────────────────
  //
  // "dashboard" ist der Sonderfall: die Startansicht wird nicht über eine
  // if-Kette gerendert, sondern ist der Normalfall der Seite. Sie MUSS im Menü
  // stehen (oben geprüft), braucht aber keine Vergleichszeile.
  const ohneAnsicht = menue.filter((v) => !gerendert.has(v) && v !== startAnsicht);
  for (const v of ohneAnsicht) {
    funde.push(
      `Menüeintrag "${v}" wird NICHT gerendert — der Klick fällt auf den `
      + `Platzhalter durch und sieht aus wie eine fertige Ansicht`
    );
  }

  const ohneMenue = [...gerendert].filter((v) => !menueSet.has(v));
  for (const v of ohneMenue) {
    funde.push(`Ansicht "${v}" wird gerendert, steht aber in KEINEM Menü — nicht erreichbar`);
  }

  // ── Der Durchfall-Platzhalter darf nichts Grünes behaupten ──────────────
  //
  // Er erscheint ausschliesslich dann, wenn nichts gebaut ist. Stand dort
  // wieder "Prepared", wäre der Fund vom 26.08. zurück — nur an anderer
  // Stelle, weil der Abgleich oben ihn dann nicht mehr sieht.
  const platzhalter = quelle.slice(quelle.indexOf("function CenterPlaceholder"));
  const kopf = platzhalter.slice(0, 2000);
  if (/Center Status[\s\S]{0,200}?(text-green-\d00[\s\S]{0,120}?)?>\s*Prepared\s*</.test(kopf)) {
    funde.push(
      `CenterPlaceholder meldet wieder "Prepared" — diese Kachel erscheint NUR, `
      + `wenn eine Ansicht gar nicht gebaut ist`
    );
  }

  // ══ Teil 2: Kennzahlen im Dashboard müssen ABGELEITET sein (03.09.) ══════
  //
  // Dieselbe Fehlerklasse wie oben, eine Ebene tiefer: die Ansicht IST gebaut,
  // aber ihre Zahlen sind erfunden. Gemessen am 03.09.:
  //
  //   BrokerCenterPanel      15 feste {label,value}-Zeilen, kein fetch —
  //                          darunter "Connected: 10". Es gibt ZWEI Broker.
  //                          Dazu zwölf Module mit grünem ACTIVE, von denen
  //                          keines einen Aufrufer im Handelspfad hat.
  //   ExecutionCenterPanel   15 feste Zeilen, kein fetch ("Queue Tickets: 11").
  //   /api/execution/tickets BAUTE die Tickets inline zusammen —
  //                          XAUUSD BUY 3365 / SL 3345 / TP 3390 / conf 96 —
  //                          und die Ansicht schrieb "Daten aus
  //                          /api/execution/tickets, Auto-Refresh 20s".
  //   mission-control/health baute sich sein eigenes Ticket und meldete
  //                          daraufhin "1 tickets, READY".
  let geprueft2 = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft2++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  for (const [datei, route] of [
    ["frontend/components/BrokerCenterPanel.tsx", "/api/broker-status"],
    ["frontend/components/ExecutionCenterPanel.tsx", "/api/execution-status"],
  ]) {
    const roh = read(datei);
    const quell = ohneKommentare(roh);
    const kurz = datei.split("/").pop();
    pruefe1(`${kurz} holt seine Zahlen nicht mehr von ${route}`,
      quell.includes(`fetch("${route}"`),
      "ohne Quelle kann die Ansicht nur behaupten");
    // Feste {label,value}-Zeilen auf Modulebene sind genau die Bauform, in der
    // die erfundenen Kennzahlen standen.
    const feste = (quell.match(/\{\s*label:\s*"[^"]+",\s*value:\s*"[^"]+"/g) ?? []).length;
    pruefe1(`${kurz} trägt wieder ${feste} fest verdrahtete Kennzahlen`,
      feste === 0, "Zahlen im Dashboard müssen abgeleitet sein");
    // Ein fehlender Wert darf nicht als 0 erscheinen — "keine Messung" und
    // "gemessen: null" sind verschiedene Aussagen.
    pruefe1(`${kurz} zeigt fehlende Werte nicht als "unbekannt"`,
      /unbekannt/.test(quell),
      "sonst sieht eine fehlende Messung wie eine Null aus");
  }

  // Die erfundenen Tickets dürfen an KEINER Stelle wiederkommen.
  for (const datei of [
    "frontend/app/api/execution/tickets/route.ts",
    "frontend/app/api/mission-control/health/route.ts",
  ]) {
    const quell = ohneKommentare(read(datei));
    pruefe1(`${datei.split("/").slice(-2).join("/")} baut wieder Tickets selbst`,
      !/TradeTicketBuilder\.build\(/.test(quell),
      "ein erfundenes Ticket mit Einstieg, Stop und Confidence sieht aus wie ein Signal");
  }

  // ── Die beiden Ableitungen RECHNEN lassen ────────────────────────────────
  const bs = ladeTsModul("lib/broker-status/broker-status.ts");
  if (bs.fehler || typeof bs.exports.brokerZustand !== "function") {
    funde.push("brokerZustand wird nicht geladen/exportiert — die Ableitung "
      + "des Broker-Zustands bleibt ungeprüft" + (bs.fehler ? `: ${bs.fehler}` : ""));
  } else {
    const bz = bs.exports.brokerZustand;
    const T = Date.parse("2026-09-03T12:00:00.000Z");

    const leer = bz(null, null, T);
    pruefe1("ohne Sitzungen werden nicht genau zwei Broker gemeldet",
      leer.broker.length === 2 && leer.gesamt === 2, String(leer.broker.length));
    pruefe1("ohne Sitzungen gilt ein Broker als verbunden", leer.verbunden === 0);
    pruefe1("ein unbekannter Saldo erscheint als Zahl statt als null",
      leer.broker.every((b) => b.saldo === null && b.kontoId === null),
      JSON.stringify(leer.broker.map((b) => b.saldo)));

    const voll = bz(
      { accountId: "A1", accountType: "DEMO", balance: 1571.82, currency: "CHF",
        connectedAt: "2026-09-03T10:00:00.000Z" },
      { accountId: "IC1", balance: 19864.27, equity: 19900, currency: "USD",
        connectedAt: "2026-09-03T11:30:00.000Z" }, T);
    pruefe1("verbundene Broker werden nicht gezählt", voll.verbunden === 2);
    pruefe1("der echte Saldo kommt nicht durch",
      voll.broker[0].saldo === 1571.82 && voll.broker[1].saldo === 19864.27);
    pruefe1("die Verbindungsdauer wird falsch gerechnet",
      voll.broker[0].stundenVerbunden === 2 && voll.broker[1].stundenVerbunden === 0.5,
      `${voll.broker[0].stundenVerbunden}/${voll.broker[1].stundenVerbunden}`);
    // Ein Saldo von 0 ist eine MESSUNG, ein fehlender Saldo nicht.
    pruefe1("ein Saldo von 0 wird zu unbekannt verfälscht",
      bz({ balance: 0 }, null, T).broker[0].saldo === 0);
    pruefe1("ein fehlender Saldo wird zu 0 verfälscht",
      bz({ accountId: "A1" }, null, T).broker[0].saldo === null);
    pruefe1("ein unlesbarer Zeitstempel ergibt 0 Stunden statt unbekannt",
      bz({ connectedAt: "kaputt" }, null, T).broker[0].stundenVerbunden === null);
    pruefe1("es wird nicht benannt, was die Ansicht NICHT misst",
      Array.isArray(leer.nichtGemessen) && leer.nichtGemessen.length > 0);
  }

  const es = ladeTsModul("lib/execution-status/execution-status.ts");
  if (es.fehler || typeof es.exports.ausfuehrungsStand !== "function") {
    funde.push("ausfuehrungsStand wird nicht geladen/exportiert — die Ableitung "
      + "des Ausführungs-Stands bleibt ungeprüft" + (es.fehler ? `: ${es.fehler}` : ""));
  } else {
    const af = es.exports.ausfuehrungsStand;
    const T = Date.parse("2026-09-03T12:00:00.000Z");

    const ohne = af(null, null, null, T);
    pruefe1("ohne Zähler wird 0 statt unbekannt gemeldet",
      ohne.heute === null && ohne.datum === null && ohne.aktuell === null,
      JSON.stringify({ h: ohne.heute, d: ohne.datum, a: ohne.aktuell }));
    pruefe1("ohne Scan wird eine Gelegenheitszahl erfunden",
      ohne.letzterScanGefunden === null && ohne.letzterScanAlterMinuten === null);

    const heute = af({ date: "2026-09-03", count: 2, byStyle: { DAYTRADING: 2 } },
      { opportunities: [1, 2, 3], updatedAt: "2026-09-03T11:45:00.000Z" },
      { maxTradesPerDay: 5, tradeLimitEnabled: true,
        maxTradesPerDayByStyle: { DAYTRADING: 3, SWING: 2 } }, T);
    pruefe1("der heutige Zähler gilt nicht als aktuell", heute.aktuell === true);
    pruefe1("die Trades von heute werden nicht durchgereicht", heute.heute === 2);
    pruefe1("die Gelegenheiten des letzten Scans werden nicht gezählt",
      heute.letzterScanGefunden === 3 && heute.letzterScanAlterMinuten === 15,
      String(heute.letzterScanAlterMinuten));
    // Ein Stil MIT Grenze aber OHNE Trades muss sichtbar bleiben.
    pruefe1("ein Stil ohne Trades fällt aus der Liste",
      heute.jeStil.length === 2
      && heute.jeStil.some((s) => s.stil === "SWING" && s.heute === 0 && s.grenze === 2),
      JSON.stringify(heute.jeStil));

    // DER GEFÄHRLICHE FALL: ein Zähler von GESTERN darf nicht als heutiger
    // Stand durchgehen — sonst sieht ein stehengebliebener Bot beschäftigt aus.
    const gestern = af({ date: "2026-09-02", count: 4 }, null, null, T);
    pruefe1("ein Zähler von gestern gilt als heutiger Stand",
      gestern.aktuell === false, String(gestern.aktuell));

    pruefe1("ein abgeschaltetes Tageslimit wird nicht gemeldet",
      af(null, null, { tradeLimitEnabled: false }, T).limitAktiv === false);
    pruefe1("ein aktives Tageslimit wird als abgeschaltet gemeldet",
      af(null, null, { tradeLimitEnabled: true }, T).limitAktiv === true
      && af(null, null, null, T).limitAktiv === true,
      "ohne Angabe gilt der Standard AN");
    pruefe1("ein unlesbarer Scan-Zeitstempel ergibt 0 Minuten statt unbekannt",
      af(null, { opportunities: [], updatedAt: "kaputt" }, null, T)
        .letzterScanAlterMinuten === null);
  }

  return {
    titel: `Menü ↔ Ansichten (${menue.length} Einträge, ${gerendert.size} gerendert, `
      + `${geprueft2} Kennzahl-Prüfungen)`,
    funde,
  };
};
