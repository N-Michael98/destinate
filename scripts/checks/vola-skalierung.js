// PRÜFT: Die Volatilitäts-Skalierung des Risikos — durch AUSFÜHREN der echten
//        Funktion, nicht durch Lesen ihrer Zahlen.
//
// WARUM ES DIESEN PRÜFER GIBT (23.08.). getVolatilityAdjustedRisk multipliziert
// das Risiko je Trade nach ATR: über 3 % nur 40 %, über 2 % 60 %, über 1,5 %
// 80 %, unter 0,3 % 70 %. Das Ergebnis geht in orchestrator-agent.ts:837 direkt
// als riskPercent in die Positionsgrösse.
//
// VORGEFÜHRT: die Schwelle 3.0 auf 30.0 gezogen — damit greift die 0,4x-Klemme
// für sehr hohe Volatilität nie mehr, es liefe volles Risiko in den bewegtesten
// Märkten. Alle sechzehn Prüfer blieben grün. Seither hält der Snapshot die
// Zahlen fest.
//
// ABER EIN SNAPSHOT RECHNET NICHT. Er hält Werte fest; ein Umbau der Funktion
// bei gleichen Literalen bliebe unsichtbar — etwa `multiplier * 2` in der
// letzten Zeile, ein entferntes `Math.max`, oder ein `else` weniger, das zwei
// Stufen zusammenfallen lässt. Genau dieselbe Lücke war der Grund, ai-clamp am
// 11.08. vom Nachbau auf die echte Funktion umzustellen.
//
// Deshalb hier: laden, aufrufen, nachrechnen.
const { read, ladeTsModul } = require("./_lib");

// Die erwartete Kette. Absichtlich HIER hingeschrieben statt aus der Datei
// gelesen: ein Prüfer, der seine Erwartung aus dem Prüfling bezieht, bestätigt
// jeden Umbau. Ändert sich die Kette bewusst, gehört diese Tabelle mitgezogen —
// und das ist im Diff sichtbar, was der Zweck ist.
const ERWARTET = [
  // [atrPct, Faktor, Begründung]
  [0.0001, 0.7, "praktisch keine Bewegung"],
  [0.1,    0.7, "unter 0,3 %"],
  [0.2999, 0.7, "knapp unter der Grenze"],
  [0.3,    1.0, "GENAU 0,3 — die Regel ist `< 0.3`, also NICHT im Niedrig-Band"],
  [0.3001, 1.0, "knapp über der Grenze"],
  [1.0,    1.0, "normal"],
  [1.5,    1.0, "GENAU 1,5 — die Regel ist `> 1.5`"],
  [1.5001, 0.8, "knapp darüber"],
  [2.0,    0.8, "GENAU 2,0 — die Regel ist `> 2.0`"],
  [2.0001, 0.6, "knapp darüber"],
  [3.0,    0.6, "GENAU 3,0 — die Regel ist `> 3.0`"],
  [3.0001, 0.4, "knapp darüber"],
  [8.0,    0.4, "sehr hohe Volatilität"],
  [50.0,   0.4, "Ausreisser bleibt im untersten Faktor"],
];

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  const modul = ladeTsModul("lib/trading-filters/trade-filters.ts");
  if (modul.fehler) {
    return { titel: "Volatilitäts-Skalierung", funde: [modul.fehler] };
  }
  const f = modul.exports.getVolatilityAdjustedRisk;
  if (typeof f !== "function") {
    return {
      titel: "Volatilitäts-Skalierung",
      funde: ["getVolatilityAdjustedRisk wird nicht exportiert — Umbenennung?"],
    };
  }

  // Die Funktion schreibt bei jeder Kürzung eine Logzeile. Im Prüfstand wäre
  // das nur Lärm, der echte Befunde überdeckt.
  const echtesLog = console.log;
  console.log = () => {};
  let ergebnisse;
  try {
    // ── Teil 1: jede Stufe und jede Grenze, beidseitig ────────────────────
    //
    // Die Grenzfälle sind der Kern. Wer aus `> 1.5` ein `>= 1.5` macht,
    // verschiebt eine ganze Stufe — die Zahlen im Snapshot bleiben dabei
    // unverändert, weil nur ein Zeichen wechselt.
    const BASIS = 2.0;   // 2 % Grundrisiko, teilbar durch alle Faktoren
    for (const [atrPct, faktor, warum] of ERWARTET) {
      // atrPct = atr / preis * 100. Mit Preis 100 ist atr = atrPct.
      const ist = f("PRUEFUNG", BASIS, atrPct, 100);
      const soll = Math.max(0.1, Math.round(BASIS * faktor * 10) / 10);
      pruefe1(
        `ATR ${atrPct} % liefert nicht ${soll} % (Faktor ${faktor}: ${warum})`,
        Math.abs(ist - soll) < 1e-9,
        `bekommen ${ist}`
      );
    }

    // ── Teil 2: Untergrenze und Rundung ──────────────────────────────────
    //
    // Math.max(0.1, ...) verhindert, dass ein kleines Grundrisiko in einem
    // hochvolatilen Markt auf null skaliert wird — eine Position mit Risiko 0
    // wäre eine Grösse 0 und damit eine stille Nicht-Ausführung.
    pruefe1("die Untergrenze von 0,1 % greift nicht",
      f("PRUEFUNG", 0.1, 8.0, 100) === 0.1, `bekommen ${f("PRUEFUNG", 0.1, 8.0, 100)}`);
    pruefe1("ein winziges Grundrisiko faellt unter die Untergrenze",
      f("PRUEFUNG", 0.01, 8.0, 100) >= 0.1);
    // Gerundet wird auf eine Nachkommastelle. Ohne Rundung entstuenden Werte
    // wie 1.7000000000000002, die weiter unten in Groessenrechnungen laufen.
    const gerundet = f("PRUEFUNG", 2.13, 8.0, 100);
    pruefe1("das Ergebnis ist nicht auf eine Nachkommastelle gerundet",
      Math.abs(gerundet * 10 - Math.round(gerundet * 10)) < 1e-9, `${gerundet}`);

    // ── Teil 3: fehlende Daten ───────────────────────────────────────────
    //
    // FESTGEHALTEN, NICHT GUTGEHEISSEN. Die Aufrufstelle übergibt
    // `taSignals?.atr ?? 0` und `candidate.bid ?? 0`. Fehlt eines davon,
    // liefert die Funktion das Grundrisiko UNGEKÜRZT zurück — fehlende Daten
    // führen also zu vollem Risiko, nicht zu weniger. Das ist heutiges
    // Verhalten; der Prüfer hält es fest, damit eine Änderung daran sichtbar
    // wird statt unbemerkt zu passieren.
    pruefe1("ohne ATR wird nicht das Grundrisiko zurueckgegeben",
      f("PRUEFUNG", 2.0, 0, 100) === 2.0);
    pruefe1("ohne Preis wird nicht das Grundrisiko zurueckgegeben",
      f("PRUEFUNG", 2.0, 1.5, 0) === 2.0);
    pruefe1("ein negativer Preis wird nicht abgefangen",
      f("PRUEFUNG", 2.0, 1.5, -5) === 2.0);

    // ── Teil 4: Eigenschaften über den ganzen Bereich ────────────────────
    //
    // Die Stufentabelle prüft Punkte. Diese Schleife prüft AUSSAGEN, die für
    // JEDEN Wert gelten müssen — dort fällt ein Umbau auf, der zufällig alle
    // Stützpunkte trifft.
    let nieGroesser = true, immerZahl = true, nieNegativ = true;
    let vorher = null, monotonAb15 = true;
    for (let i = 0; i <= 6000; i++) {
      const atrPct = i / 1000;                 // 0,000 bis 6,000 in Tausendstel
      const r = f("PRUEFUNG", 2.0, atrPct, 100);
      if (!Number.isFinite(r)) immerZahl = false;
      if (r < 0) nieNegativ = false;
      // atrPct 0 schaltet die Skalierung ab (siehe Teil 3) — dort ist r = Basis.
      if (atrPct > 0 && r > 2.0 + 1e-9) nieGroesser = false;
      if (atrPct >= 1.5) {
        if (vorher !== null && r > vorher + 1e-9) monotonAb15 = false;
        vorher = r;
      }
    }
    // DIE WICHTIGSTE ZEILE. Kein ATR-Wert darf das Risiko ERHOEHEN. Ein Faktor
    // über 1.0 wäre eine Vergrösserung der Position wegen Volatilität — das
    // Gegenteil der Absicht, und keine der Zahlen im Snapshot würde es zeigen.
    pruefe1("es gibt ATR-Werte, bei denen das Risiko STEIGT statt zu sinken", nieGroesser);
    pruefe1("die Funktion liefert bei manchen Eingaben keine Zahl", immerZahl);
    pruefe1("die Funktion kann ein negatives Risiko liefern", nieNegativ);
    pruefe1("ab 1,5 % ATR sinkt das Risiko nicht mehr durchgehend", monotonAb15);

    ergebnisse = true;
  } finally {
    console.log = echtesLog;
  }
  if (!ergebnisse) funde.push("die Prüfrechnung lief nicht durch");

  // ── Teil 5: die Verdrahtung ────────────────────────────────────────────
  //
  // Eine tadellose Funktion nützt nichts, wenn ihr Ergebnis nicht ankommt.
  // Genau diese Fehlerklasse — gebaut, aber nicht verdrahtet — hat in diesem
  // Repository wiederholt zugeschlagen. Geprüft wird deshalb der WEG des
  // Rückgabewerts, nicht nur, dass die Funktion irgendwo erwähnt wird.
  const orch = ohneKommentareUndTexte(read("frontend/lib/agents/orchestrator-agent.ts"));
  pruefe1("der Orchestrator holt die Skalierung nicht",
    /getVolatilityAdjustedRisk/.test(orch));
  pruefe1("das Ergebnis wird nicht als riskPct uebernommen",
    /const\s+riskPct\s*=\s*getVolatilityAdjustedRisk\(/.test(orch));
  // riskPct muss in die AUSFUEHRUNG gehen, nicht nur ins Protokoll.
  //
  // AUFRUFGENAU, und das ist der Punkt: `riskPercent: riskPct` steht ZWEIMAL
  // in dieser Datei — einmal im Aufruf von runExecutionAgent, der die Order
  // platziert, und einmal in der Journal-Zeile. Ein Prüfer, der die Datei nur
  // nach dem Muster durchsucht, bleibt gruen, wenn die AUSFUEHRUNG auf das
  // ungekuerzte Grundrisiko umgestellt wird und bloss die Journal-Zeile
  // stehen bleibt. Genau das schluepfte im Sabotage-Lauf vom 23.08. durch.
  const ausfuehrung = aufrufBlock(orch, "runExecutionAgent");
  pruefe1("der Aufruf von runExecutionAgent ist nicht auffindbar",
    ausfuehrung !== null);
  if (ausfuehrung !== null) {
    pruefe1("die ORDER bekommt nicht das skalierte Risiko",
      /riskPercent:\s*riskPct\b/.test(ausfuehrung),
      "runExecutionAgent erhaelt ein anderes riskPercent");
  }
  const treffer = (orch.match(/\briskPct\b/g) || []).length;
  pruefe1("riskPct wird seltener benutzt als erwartet", treffer >= 4,
    `${treffer} Verwendungen (ohne Kommentare und Texte)`);

  return {
    titel: `Volatilitäts-Skalierung (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};

/** Kommentare und Zeichenketten entfernen.
 *
 * Diese Fehlerklasse hat 2026 mehrfach zugeschlagen: ein Prüfer suchte einen
 * Namen und fand ihn in einem Kommentar oder einer Logzeile, während die echte
 * Verdrahtung fehlte. `riskPct` steht im Orchestrator auch in Logausgaben.
 */
/** Der Argument-Block eines Aufrufs `name(...)`, klammer-ausgewogen.
 *
 * Gebraucht, weil dieselbe Zuweisung an mehreren Stellen der Datei steht und
 * nur EINE davon die Order platziert. Ohne diese Eingrenzung prueft man die
 * Datei, nicht den Aufruf. Rueckgabe null, wenn der Aufruf fehlt — das ist
 * selbst ein Befund und wird oben behandelt.
 */
function aufrufBlock(src, name) {
  const start = src.indexOf(`${name}(`);
  if (start < 0) return null;
  let tiefe = 0;
  for (let i = start + name.length; i < src.length; i++) {
    const z = src[i];
    if (z === "(") tiefe++;
    else if (z === ")") {
      tiefe--;
      if (tiefe === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

function ohneKommentareUndTexte(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}
