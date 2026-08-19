// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 16: Überwachung des Python-Backends — FÜHRT DIE ZÄHLUNG WIRKLICH AUS
//
// DER FUND (18.08., Generalkontrolle). Das Python-Backend wurde im Hintergrund
// GAR NICHT überwacht:
//   - `pyHealthCheck()` hatte keinen Aufrufer
//   - `/api/market-data/health` holt nur LiveMarketWidget.tsx — also nur,
//     solange jemand die Seite offen hat
//   - der Diagnostics-Agent prüfte ausschliesslich Agenten
// Alle Python-Aufrufe geben bei Fehlern still `null` zurück und das System
// läuft regelbasiert weiter. Richtig als Verhalten — aber ein Ausfall über
// Nacht fiel niemandem auf.
//
// Über diesen Dienst laufen der Python-Lifecycle (Breakeven, Teilgewinn,
// Trailing, Zeit-Exit als ZWEITE Schicht) und die Datenversorgung der
// Analysis-Engine (OHLCV, Konsens- und Muster-Rückrechnung).
//
// ZWEITER FUND, im bestehenden Code (11.08.). Der Alarm des AI Managers rief
// sendDiagnosticsAlert() direkt, sobald `erreichbar === false` galt. Der
// Diagnostics-Agent läuft alle fünf Minuten — also kam während eines Ausfalls
// alle fünf Minuten dieselbe Nachricht, ohne Ende. AGENT_DEAD ist über
// `hb.status !== "DEAD"` gesichert, recordAnomaly meldet nur beim Erreichen der
// Schwelle; nur dieser eine Alarm hatte keinen Riegel.
//
// WARUM HIER GERECHNET WIRD. Eine Überwachung, die falsch zählt, ist schlimmer
// als keine: ein vertauschtes `>=`, ein fehlender Null-Fall oder ein
// zurückgesetzter Merker macht sie entweder blind oder zum Dauermelder. Beides
// bliebe strukturell unauffällig. Deshalb werden meldePythonAufruf(),
// getPythonStatus(), pythonUebergang() und aiManagerUebergang() ECHT gerufen.
// ─────────────────────────────────────────────────────────────────────────────

const { ROOT, read, ladeTsModul } = require("./_lib");

/**
 * Entfernt Kommentare und Zeichenketten.
 *
 * Dieselbe Vorsichtsmassnahme wie in lifecycle-rueckkehr.js: am 18.08. rutschte
 * eine Sabotage durch, weil ein Kommentar den gesuchten Namen enthielt. Ein
 * Wort im Kommentar ist keine Verwendung.
 */
function ohneKommentareUndTexte(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``")
    .replace(/"(?:\\.|[^\\"])*"/g, '""')
    .replace(/'(?:\\.|[^\\'])*'/g, "''");
}

/**
 * Entfernt NUR Kommentare, lässt Zeichenketten stehen.
 *
 * Gebraucht dort, wo der Beleg selbst in einer Zeichenkette steht — etwa der
 * Anomalie-Name "PYTHON_BACKEND_AUSFALL" oder der Fehlertext
 * `HTTP ${res.status}`. Die schärfere Variante oben würde sie mitlöschen und
 * einen vorhandenen Riegel als fehlend melden (genau das passierte im ersten
 * Lauf dieses Prüfers). Kommentare fliegen trotzdem raus — ein Wort im
 * Kommentar bleibt keine Verwendung.
 */
function ohneKommentare(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function aufrufe(rohText, name) {
  const text = ohneKommentareUndTexte(rohText);
  let n = 0;
  const re = new RegExp(`\\b${name}\\s*\\(`, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const davor = text.slice(Math.max(0, m.index - 60), m.index);
    if (/\b(function|const|let|var)\s+$/.test(davor)) continue;
    if (/async\s+function\s+$/.test(davor)) continue;
    if (/\bimport\s*\{[^}]*$/.test(davor)) continue;
    n++;
  }
  return n;
}

module.exports = function pruefe() {
  const funde = [];

  const py = ladeTsModul("lib/python-backend/python-status.ts");
  if (py.fehler) {
    funde.push(py.fehler);
    return { titel: "Python-Überwachung (nicht ausführbar)", funde };
  }
  const { meldePythonAufruf, getPythonStatus, pythonUebergang,
          resetPythonStatus, AUSFALL_AB_FEHLERN } = py.exports;
  for (const [name, f] of Object.entries({ meldePythonAufruf, getPythonStatus,
                                           pythonUebergang, resetPythonStatus })) {
    if (typeof f !== "function") {
      funde.push(`${name} wird nicht exportiert — die Überwachung bleibt ungeprüft`);
    }
  }
  if (funde.length) return { titel: "Python-Überwachung (nicht ausführbar)", funde };

  let geprueft = 0;
  const p1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  // ── Teil 1: die Zählung ───────────────────────────────────────────────────
  resetPythonStatus();
  p1("frisch gestartet meldet nicht 'nie gerufen' (null)",
    getPythonStatus().erreichbar === null,
    "ohne gesetzte PYTHON_BACKEND_URL wird gar nicht gerufen — kein Ausfall");
  p1("frisch gestartet zählt nicht bei 0", getPythonStatus().gesamt === 0);

  meldePythonAufruf("/api/v1/lifecycle/trades", true);
  let s = getPythonStatus();
  p1("ein erfolgreicher Aufruf macht ihn erreichbar", s.erreichbar === true);
  p1("der Erfolg wird gezählt", s.erfolge === 1 && s.gesamt === 1);
  p1("der erfolgreiche Pfad wird festgehalten",
    s.letzterErfolgPfad === "/api/v1/lifecycle/trades");

  for (let i = 0; i < AUSFALL_AB_FEHLERN; i++) {
    meldePythonAufruf("/api/v1/lifecycle/balance", false, "HTTP 401");
  }
  s = getPythonStatus();
  p1(`${AUSFALL_AB_FEHLERN} Fehlschläge in Folge gelten nicht als Ausfall`,
    s.erreichbar === false, String(s.erreichbar));
  p1("der Fehlergrund wird nicht festgehalten", (s.letzterFehler || "").includes("401"));
  p1("der fehlerhafte Pfad wird nicht festgehalten",
    s.letzterFehlerPfad === "/api/v1/lifecycle/balance",
    "ohne ihn weiss niemand, WAS ausfällt");
  p1("der Fehleranteil wird nicht berechnet", s.fehlerAnteilPct > 0);

  // Eine Schwelle darf nicht schon EINEN Schritt zu früh greifen.
  resetPythonStatus();
  for (let i = 0; i < AUSFALL_AB_FEHLERN - 1; i++) meldePythonAufruf("/x", false, "e");
  p1(`${AUSFALL_AB_FEHLERN - 1} Fehlschläge gelten fälschlich schon als Ausfall`,
    getPythonStatus().erreichbar === true);

  meldePythonAufruf("/x", true);
  s = getPythonStatus();
  p1("nach einer Antwort erholt er sich nicht",
    s.erreichbar === true && s.fehlerInFolge === 0);

  // ── Teil 2: der Riegel gegen Dauermeldungen ───────────────────────────────
  resetPythonStatus();
  p1("ohne Aufruf wird ein Wechsel gemeldet", pythonUebergang() === null);
  meldePythonAufruf("/x", true);
  p1("ein Erfolg allein löst schon einen Wechsel aus", pythonUebergang() === null);

  for (let i = 0; i < AUSFALL_AB_FEHLERN; i++) meldePythonAufruf("/x", false, "timeout");
  p1("der Ausfall wird nicht gemeldet", pythonUebergang() === "AUSFALL");
  p1("derselbe Ausfall wird ein ZWEITES Mal gemeldet", pythonUebergang() === null,
    "sonst kommt alle fünf Minuten dieselbe Telegram-Nachricht");
  p1("und ein drittes Mal", pythonUebergang() === null);
  meldePythonAufruf("/x", false, "timeout");
  p1("ein weiterer Fehlschlag meldet den Ausfall erneut", pythonUebergang() === null);

  meldePythonAufruf("/x", true);
  p1("die Entwarnung wird nicht gemeldet", pythonUebergang() === "ERHOLT",
    "ohne sie weiss niemand, ob der Ausfall noch anhält");
  p1("die Entwarnung wird doppelt gemeldet", pythonUebergang() === null);

  for (let i = 0; i < AUSFALL_AB_FEHLERN; i++) meldePythonAufruf("/x", false, "e");
  p1("ein ZWEITER Ausfall wird nicht mehr gemeldet", pythonUebergang() === "AUSFALL");

  // ── Teil 3: Zählen darf niemals werfen ────────────────────────────────────
  for (const arg of [null, undefined, 42, {}, []]) {
    let geworfen = false;
    try { meldePythonAufruf(arg, arg, arg); } catch { geworfen = true; }
    p1(`meldePythonAufruf(${String(arg)}) wirft — das würde den Zyklus abbrechen`,
      !geworfen);
  }
  let geworfen = false;
  try { pythonUebergang(); getPythonStatus(); } catch { geworfen = true; }
  p1("Abfragen wirft nach Unsinn-Eingaben", !geworfen);
  resetPythonStatus();

  // ── Teil 4: derselbe Riegel beim AI Manager (Korrektur 19.08.) ───────────
  const ai = ladeTsModul("lib/agents/ai-manager-status.ts");
  if (ai.fehler) {
    funde.push(ai.fehler);
  } else if (typeof ai.exports.aiManagerUebergang !== "function") {
    funde.push("aiManagerUebergang wird nicht exportiert — der AI-Alarm bliebe "
      + "ein Dauermelder (alle 5 Minuten dieselbe Nachricht)");
  } else {
    const { meldeAIEntscheidung, aiManagerUebergang, resetAIManagerStatus,
            AUSFALL_AB_FEHLERN: AI_SCHWELLE } = ai.exports;
    resetAIManagerStatus();
    p1("AI: ohne Anfrage wird ein Wechsel gemeldet", aiManagerUebergang() === null);
    meldeAIEntscheidung("BREAKEVEN", "APPROVE");
    p1("AI: eine Antwort löst schon einen Wechsel aus", aiManagerUebergang() === null);
    for (let i = 0; i < AI_SCHWELLE; i++) meldeAIEntscheidung("TRAIL", "FALLBACK", "kein Guthaben");
    p1("AI: der Ausfall wird nicht gemeldet", aiManagerUebergang() === "AUSFALL");
    p1("AI: derselbe Ausfall wird ein zweites Mal gemeldet",
      aiManagerUebergang() === null,
      "genau dieser Fehler steckte im Alarm vom 11.08.");
    meldeAIEntscheidung("BREAKEVEN", "SKIP");
    p1("AI: die Entwarnung wird nicht gemeldet", aiManagerUebergang() === "ERHOLT");
    p1("AI: die Entwarnung wird doppelt gemeldet", aiManagerUebergang() === null);
    resetAIManagerStatus();
  }

  // ── Teil 5: ist die Zählung auch VERDRAHTET? ─────────────────────────────
  const client = read("frontend/lib/python-backend/python-client.ts");
  const diag = read("frontend/lib/agents/diagnostics-agent.ts");
  const diagC = ohneKommentareUndTexte(diag);

  // post() und get() haben je drei Ausgänge: HTTP-Fehler, Erfolg, Ausnahme.
  // Der erste Entwurf prüfte nur, OB irgendwo gemeldet wird — damit liess sich
  // im Sabotage-Lauf eine einzelne Stelle ersatzlos streichen.
  const meldungen = aufrufe(client, "meldePythonAufruf");
  p1("nicht alle sechs Ausgänge melden (post/get × Fehler/Erfolg/Ausnahme)",
    meldungen === 6, `${meldungen} von 6`);
  const clientK = ohneKommentare(client);
  p1("HTTP-Fehler werden nicht mit ihrem Status verbucht",
    (clientK.match(/meldePythonAufruf\([^)]*false,\s*`HTTP \$\{res\.status\}`\)/g) || []).length === 2,
    "ein dauerhaftes 401 war genau der Fund vom 02.08. — der Status muss mit");
  p1("nicht beide Fehlerwege verbuchen (HTTP-Status und Ausnahme)",
    (ohneKommentareUndTexte(client).match(/meldePythonAufruf\([^,]+,\s*false/g) || []).length === 4,
    "je zwei in post() und get()");
  p1("Erfolge werden nicht verbucht",
    (ohneKommentareUndTexte(client).match(/meldePythonAufruf\([^,]+,\s*true\)/g) || []).length === 2,
    "ohne sie erholt sich der Zähler nie");

  p1("der Diagnostics-Agent prüft den Python-Wechsel nicht",
    aufrufe(diag, "pythonUebergang") >= 1);
  p1("der Diagnostics-Agent meldet keinen Python-Ausfall",
    /recordAnomaly\(\s*[`"']PYTHON_BACKEND_AUSFALL/.test(ohneKommentare(diag)),
    "der Name muss in einem echten recordAnomaly-Aufruf stehen, nicht in einem Kommentar");
  p1("der Diagnostics-Agent nutzt beim AI Manager weiter den Zustand statt des Wechsels",
    aufrufe(diag, "aiManagerUebergang") >= 1
    && !/aiStatus\.erreichbar\s*===\s*false/.test(diagC),
    "sonst bleibt der Dauermelder vom 11.08. bestehen");

  const route = read("frontend/app/api/python-status/route.ts");
  p1("die Route /api/python-status fehlt", route.length > 0);
  p1("die Route liefert den Zustand nicht aus",
    aufrufe(route, "getPythonStatus") >= 1);

  return {
    titel: `Python-Überwachung (${geprueft} Prüfungen, Zählung ausgeführt)`,
    funde,
  };
};
