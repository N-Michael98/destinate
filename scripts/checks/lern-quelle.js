// PRÜFT: Der Lernzyklus lernt aus ECHTEN Trades — durch Ausführen der echten
//        Funktion mit einer nachgebauten Datenbankantwort.
//
// WARUM (24.08.). Bis heute las `runLearningCycle` ausschliesslich die
// PAPIERHANDELS-Historie. Der Zyklus lernte also aus Simulationen, während die
// echten geschlossenen Trades in der `Trade`-Tabelle danebenlagen und nie
// angefasst wurden — und dem Bericht sah man das nicht an.
//
// Zwei getrennte Lernstränge lagen im Programm:
//   lib/learning/                     echte Logik, Konsument vorhanden
//                                     (evolution-engine), Quelle war Papier
//   lib/learning-feedback-integration/  Mock-Daten, GAR KEIN Konsument
// Dieser Prüfer sichert den ersten.
//
// WAS ER NICHT BEHAUPTET: dass das Gelernte irgendetwas am Handel ändert. Der
// Faktor aus getLearningAdjustmentFactor wird bisher nur von evolution-engine
// gelesen, und das läuft in keiner Schleife. Der Weg dorthin ist eine eigene,
// bewusste Entscheidung — hier wird nur geprüft, dass die ZAHLEN stimmen und
// aus der richtigen Quelle kommen.
const { read, ladeTsModul } = require("./_lib");

// Sieben geschlossene Trades mit von Hand nachgerechnetem Ergebnis.
// EURUSD: 2 Gewinne, 1 Verlust, 1 Nullrunde -> 4 Trades, WinRate 2/4 = 50 %
// XAUUSD: 2 Gewinne, 1 Verlust             -> 3 Trades, WinRate 2/3 = 66,7 %
const ZEILEN = [
  { market: "EURUSD", direction: "BUY",   profitLoss:  120, updatedAt: new Date("2026-08-01") },
  { market: "EURUSD", direction: "SELL",  profitLoss:  -80, updatedAt: new Date("2026-08-02") },
  { market: "EURUSD", direction: "buy",   profitLoss:   45, updatedAt: new Date("2026-08-03") },
  { market: "EURUSD", direction: "BUY",   profitLoss:    0, updatedAt: new Date("2026-08-04") },
  { market: "XAUUSD", direction: "SHORT", profitLoss:  300, updatedAt: new Date("2026-08-05") },
  { market: "XAUUSD", direction: "BUY",   profitLoss: -150, updatedAt: new Date("2026-08-06") },
  { market: "XAUUSD", direction: "BUY",   profitLoss:  200, updatedAt: new Date("2026-08-07") },
  // Ohne Markt — darf NICHT als Symbol "UNKNOWN" in der Lerntabelle landen.
  { market: null, direction: null, profitLoss: 999, updatedAt: null, createdAt: new Date("2026-08-08") },
];

// OFFENE Trades. Sie stehen mit in der Tabelle und dürfen NICHT gelernt
// werden: ihr profitLoss ist der Zwischenstand, kein Ergebnis. Wer daraus
// lernt, lernt aus einem Zufall.
//
// Sie liegen hier, weil der Prüfstand die `where`-Bedingung ECHT anwendet
// (siehe unten). Im Sabotage-Lauf vom 24.08. liess sich `where` auf `{}`
// setzen, ohne dass etwas rot wurde — der Stub hatte die Bedingung schlicht
// ignoriert. Ein Prüfstand, der die Abfrage nicht nachbildet, prüft die
// Abfrage nicht.
const OFFENE = [
  { market: "GBPUSD", direction: "BUY", profitLoss: 5000, status: "OPEN", updatedAt: new Date("2026-08-10") },
  { market: "USDJPY", direction: "SELL", profitLoss: -3000, status: "OPEN", updatedAt: new Date("2026-08-11") },
];

/** Bildet `where: { status: { not: "OPEN" } }` wirklich nach. */
function findManyNachbau(alle, args) {
  const nicht = args?.where?.status?.not;
  if (nicht === undefined) return alle;              // keine Bedingung = alles
  return alle.filter((z) => (z.status ?? "CLOSED") !== nicht);
}

function baue(zeilen, dbWirft = false) {
  let zustand = {
    learningCycles: 0, totalTradesAnalyzed: 0, symbolPerformance: {},
    strategyAdjustments: {}, predictionAccuracy: { total: 0, correct: 0, accuracy: 0 },
    pendingPredictions: [], insights: [], lastAnalyzed: "",
  };
  return ladeTsModul("lib/learning/trade-feedback-engine.ts", {
    prisma: {
      getPrisma: () => {
        if (dbWirft) throw new Error("DB weg (Prüfstand)");
        return {
          trade: {
            findMany: async (args) => findManyNachbau([...zeilen, ...OFFENE], args),
          },
        };
      },
    },
    "paper-history": {
      PaperHistory: {
        getAll: () => ([{
          entity: "POSITION", event: "POSITION_CLOSED", timestamp: "2026-08-09",
          // Absichtlich ein anderes Symbol: so fällt auf, wenn die Quelle
          // nicht beachtet wird und Papier in "echt" hineinrutscht.
          payload: { pnl: 999, symbol: "PAPIERSYMBOL", direction: "BUY" },
        }]),
      },
    },
    "learning-store": {
      readLearningState: () => zustand,
      writeLearningState: (s) => { zustand = s; },
    },
  });
}

module.exports = async function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  const modul = baue(ZEILEN);
  if (modul.fehler) return { titel: "Lern-Quelle", funde: [modul.fehler] };
  const M = modul.exports;
  for (const name of ["echteGeschlosseneTrades", "runLearningCycle", "getLearningAdjustmentFactor"]) {
    if (typeof M[name] !== "function") {
      return { titel: "Lern-Quelle", funde: [`${name} wird nicht exportiert — Umbenennung?`] };
    }
  }

  const echtesLog = console.log;
  const echteWarnung = console.warn;
  const echterFehler = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try {
    // ── Teil 1: die Übersetzung Datenbankzeile -> Lerneintrag ────────────
    const trades = await M.echteGeschlosseneTrades();
    pruefe1("nicht alle brauchbaren Trades gelesen", trades.length === 7,
      `${trades.length} statt 7`);
    pruefe1("ein Trade OHNE Markt landet in der Lerntabelle",
      !trades.some((t) => !t.symbol || t.symbol === "UNKNOWN"),
      JSON.stringify(trades.map((t) => t.symbol)));
    // OFFENE Trades dürfen nicht mitgelernt werden: ihr profitLoss ist der
    // Zwischenstand, kein Ergebnis. Der Prüfstand wendet die where-Bedingung
    // echt an, deshalb misst diese Zeile das Verhalten und nicht den Text.
    pruefe1("OFFENE Trades werden mitgelernt",
      !trades.some((t) => t.symbol === "GBPUSD" || t.symbol === "USDJPY"),
      JSON.stringify(trades.map((t) => t.symbol)));

    // Ergebnis aus dem Geldbetrag — der Kern. Wer hier `>= 0` schreibt,
    // macht aus jeder Nullrunde einen Gewinn und verzerrt jede Win-Rate.
    const gewinne = trades.filter((t) => t.outcome === "WIN").length;
    const verluste = trades.filter((t) => t.outcome === "LOSS").length;
    const null_ = trades.filter((t) => t.outcome === "BREAKEVEN").length;
    pruefe1("Gewinne falsch gezählt", gewinne === 4, `${gewinne} statt 4`);
    pruefe1("Verluste falsch gezählt", verluste === 2, `${verluste} statt 2`);
    pruefe1("Nullrunden falsch gezählt", null_ === 1, `${null_} statt 1`);
    pruefe1("ein Verlust gilt als Gewinn",
      !trades.some((t) => t.pnl < 0 && t.outcome === "WIN"));
    pruefe1("ein Gewinn gilt als Verlust",
      !trades.some((t) => t.pnl > 0 && t.outcome === "LOSS"));

    // Richtung: Freitext aus der Datenbank, gross/klein gemischt.
    const shortTrade = trades.find((t) => t.pnl === 300);
    pruefe1("SHORT wird nicht als SELL erkannt", shortTrade?.direction === "SELL",
      String(shortTrade?.direction));
    const kleinBuy = trades.find((t) => t.pnl === 45);
    pruefe1("kleingeschriebenes buy wird nicht erkannt", kleinBuy?.direction === "BUY",
      String(kleinBuy?.direction));

    // ── Teil 2: der Zyklus rechnet daraus die richtigen Kennzahlen ───────
    const echt = await M.runLearningCycle(["capital"], "echt");
    pruefe1("die Quelle steht nicht im Bericht", echt.quelle === "echt", String(echt.quelle));
    pruefe1("falsche Anzahl analysierter Trades", echt.totalTradesAnalyzed === 7,
      `${echt.totalTradesAnalyzed} statt 7`);
    const eur = echt.symbolPerformance?.EURUSD;
    const xau = echt.symbolPerformance?.XAUUSD;
    pruefe1("EURUSD fehlt in der Auswertung", !!eur);
    pruefe1("XAUUSD fehlt in der Auswertung", !!xau);
    if (eur) {
      pruefe1("EURUSD: falsche Trade-Zahl", eur.trades === 4, `${eur.trades}`);
      pruefe1("EURUSD: falsche Win-Rate", Math.abs(eur.winRate - 50) < 0.05, `${eur.winRate}`);
      pruefe1("EURUSD: falscher Gesamtgewinn", Math.abs(eur.totalPnl - 85) < 0.01, `${eur.totalPnl}`);
    }
    if (xau) {
      pruefe1("XAUUSD: falsche Trade-Zahl", xau.trades === 3, `${xau.trades}`);
      pruefe1("XAUUSD: falsche Win-Rate", Math.abs(xau.winRate - 66.7) < 0.05, `${xau.winRate}`);
      pruefe1("XAUUSD: falscher Gesamtgewinn", Math.abs(xau.totalPnl - 350) < 0.01, `${xau.totalPnl}`);
    }
    pruefe1("Papier-Daten sind in die echte Quelle geraten",
      !Object.keys(echt.symbolPerformance || {}).includes("PAPIERSYMBOL"),
      JSON.stringify(Object.keys(echt.symbolPerformance || {})));

    // ── Teil 3: die Quellen bleiben getrennt ─────────────────────────────
    const papier = await M.runLearningCycle(["capital"], "papier");
    pruefe1("Quelle 'papier' meldet sich nicht als solche", papier.quelle === "papier");
    pruefe1("bei Quelle 'papier' kommen echte Trades mit",
      !Object.keys(papier.symbolPerformance || {}).some((s) => s === "EURUSD" || s === "XAUUSD"),
      JSON.stringify(Object.keys(papier.symbolPerformance || {})));
    const beide = await M.runLearningCycle(["capital"], "beide");
    pruefe1("'beide' vereint die Quellen nicht", beide.totalTradesAnalyzed === 8,
      `${beide.totalTradesAnalyzed} statt 8`);

    // ── Teil 4: eine unerreichbare Datenbank darf nichts umbringen ───────
    //
    // Der Zyklus soll aus einer Schleife laufen. Eine Ausnahme von hier würde
    // diese Schleife töten — derselbe Fehler wie am 19.08. beim
    // Datenbank-Vorlauf in instrumentation.ts.
    const kaputt = baue(ZEILEN, true);
    pruefe1("Modul lädt mit kaputter Datenbank nicht", !kaputt.fehler, kaputt.fehler);
    if (!kaputt.fehler) {
      let geworfen = null;
      let leer = null;
      try {
        leer = await kaputt.exports.echteGeschlosseneTrades();
      } catch (e) { geworfen = e; }
      pruefe1("unerreichbare Datenbank wirft eine Ausnahme", geworfen === null,
        geworfen ? String(geworfen.message) : "");
      pruefe1("unerreichbare Datenbank liefert kein leeres Ergebnis",
        Array.isArray(leer) && leer.length === 0);
    }
  } finally {
    console.log = echtesLog; console.warn = echteWarnung; console.error = echterFehler;
  }

  // ── Teil 5: die Voreinstellung ist ECHT, nicht Papier ─────────────────
  //
  // Ohne diese Prüfung liesse sich der Standard still auf "papier"
  // zurückdrehen: alle Rechnungen oben blieben grün, weil sie die Quelle
  // ausdrücklich mitgeben — und der Betrieb lernte wieder aus Simulationen.
  const src = read("frontend/lib/learning/trade-feedback-engine.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  pruefe1("die Voreinstellung der Quelle ist nicht 'echt'",
    /quelle:\s*LernQuelle\s*=\s*"echt"/.test(src));
  pruefe1("der Zyklus liest die echten Trades nicht",
    /await\s+echteGeschlosseneTrades\(\)/.test(src));
  pruefe1("die Quelle wird nicht in den Bericht geschrieben",
    /\bquelle,?\s*\n\s*\};/.test(src) || /quelle:\s*quelle/.test(src));

  // ── Teil 6: der Zyklus wird auch WIRKLICH gefahren ────────────────────
  //
  // Bis zum 24.08. hing runLearningCycle an zwei API-Routen, die von Hand
  // angestossen werden mussten. Eine Auswertung, die nur läuft, wenn jemand
  // daran denkt, ist keine Auswertung.
  //
  // EHRLICHE ABGRENZUNG: die Schleife selbst lässt sich hier nicht ausführen —
  // instrumentation.ts baut beim Laden Broker-Sitzungen und Handelsschleifen
  // auf. Geprüft wird deshalb die VERDRAHTUNG im Quelltext, wie bei allen
  // anderen Schleifen dieser Datei auch. Die Rechnung steckt in den Teilen
  // 1 bis 5: die Funktion, die hier gerufen wird, ist dort nachgerechnet.
  //
  // EINGEGRENZT auf den Lern-Block: `isKillswitchActive` und `setInterval`
  // stehen in dieser Datei ein Dutzend Mal. Wer die ganze Datei durchsucht,
  // findet die Wachen einer FREMDEN Schleife und hält sie für die eigenen —
  // genau die Fehlerklasse, für die es funktionsRumpf() gibt.
  const instr = read("frontend/instrumentation.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const start = instr.indexOf("runLearningCycle } = await import");
  pruefe1("keine Schleife ruft den Lernzyklus", start >= 0);
  if (start >= 0) {
    // ENDE GENAU BESTIMMEN, nicht schätzen. Die erste Fassung nahm 2600
    // Zeichen ab dem Anfang — und reichte damit in die NÄCHSTE Schleife
    // hinein. Im Sabotage-Lauf vom 24.08. liess sich der Fehlerabfang des
    // Lernzyklus ersatzlos streichen, und der Prüfer blieb grün: er hatte das
    // `catch (err)` einer fremden Schleife gefunden. Genau die Fehlerklasse,
    // die hier am häufigsten zuschlägt.
    //
    // Der Block endet an seiner eigenen Startmeldung — jede Schleife in
    // instrumentation.ts schliesst mit einer solchen Zeile ab.
    const endeRel = instr.slice(start).indexOf('console.log("[instrumentation] Lernzyklus');
    const block = instr.slice(start, endeRel > 0 ? start + endeRel : start + 2600);
    pruefe1("der Lern-Block ist nicht abgrenzbar", endeRel > 0);
    pruefe1("der Lernzyklus wird nicht aufgerufen",
      /await\s+runLearningCycle\(\)/.test(block));
    pruefe1("keine Wiederholung eingerichtet", /setInterval\(/.test(block));
    pruefe1("kein erster Lauf nach dem Start", /setTimeout\(/.test(block));
    pruefe1("kein Riegel gegen überlappende Läufe",
      /if\s*\(\s*lernzyklusLaeuft\s*\)/.test(block));
    pruefe1("der Riegel wird nicht wieder freigegeben",
      /finally\s*\{\s*lernzyklusLaeuft\s*=\s*false/.test(block));
    pruefe1("der Killswitch sperrt den Lernzyklus nicht",
      /isKillswitchActive\(\)/.test(block));
    // Nicht nur "irgendwo steht ein catch", sondern: der Fehlerabfang DIESES
    // Zyklus mit SEINER Meldung. Ohne ihn läuft eine unbehandelte
    // Promise-Ablehnung — und die beendet in Node den ganzen Dienst.
    pruefe1("ein Fehler im Zyklus kann die Schleife töten",
      /\}\s*catch\s*\([^)]*\)\s*\{\s*console\.error\(\s*\n?\s*"\[learning\] Zyklus-Fehler:"/.test(block),
      "kein eigener Fehlerabfang mit [learning]-Meldung");
    // Die Wiederholung darf nicht im Minutentakt laufen: der Zyklus liest bei
    // jedem Lauf ALLE geschlossenen Trades, und es gibt keinen Index auf
    // `status`. Geschlossene Trades entstehen ein paar Mal am Tag.
    const takt = block.match(/setInterval\([^,]+,\s*([0-9*\s_]+)\)/);
    const ms = takt ? Function(`"use strict";return (${takt[1]})`)() : 0;
    pruefe1("der Lernzyklus läuft häufiger als alle 15 Minuten",
      ms >= 15 * 60 * 1000, `${Math.round(ms / 60000)} Minuten`);
  }

  return { titel: `Lern-Quelle (${geprueft} Rechnungen, echte Funktion)`, funde };
};
