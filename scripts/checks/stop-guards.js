// PRÜFT: Jede Stelle, die einen Broker-Stop schreibt, hat ihren Riegel.
//
// WARUM: Zwei Systeme bewegen denselben Stop im selben Zwei-Minuten-Zyklus —
// der RiskAgent und der Python-Lifecycle. Vor dem 03.08. verglich jeder nur
// gegen die EIGENE Erinnerung; damit konnte jeder eine Absicherung
// zurücknehmen, die der andere gerade gesetzt hatte (durchgerechnet: Agent
// merkt sich 105, Python zieht auf 108, Agent rechnet 106 und schreibt es).
//
// EHRLICHE ABGRENZUNG: Dieser Prüfer bestätigt, dass die Riegel im Quelltext
// VORHANDEN und an der richtigen Stelle sind. Er führt die Handelslogik nicht
// aus. Er schlägt also an, wenn jemand einen Riegel entfernt oder umbenennt —
// nicht, wenn jemand ihn subtil falsch umbaut.
const { read } = require("./_lib");

module.exports = function pruefe() {
  const funde = [];
  const instr = read("frontend/instrumentation.ts");
  const risk  = read("frontend/lib/agents/risk-agent.ts");

  // ── Stelle 1: Python-Lifecycle in instrumentation.ts ──────────────────────
  if (!/istEnger/.test(instr)) {
    funde.push("instrumentation.ts: Riegel 'istEnger' fehlt — Python-Lifecycle könnte einen Stop lockern");
  } else {
    // Der Riegel muss VOR dem Schreiben stehen, nicht danach.
    const posRiegel = instr.indexOf("istEnger");
    const posSchreiben = instr.indexOf("capitalUpdatePosition(sess.apiKey");
    if (posSchreiben > 0 && posRiegel > posSchreiben) {
      funde.push("instrumentation.ts: 'istEnger' steht NACH dem Schreiben des Stops");
    }
    if (!/if\s*\(!istEnger\)\s*\{[\s\S]{0,200}?continue;/.test(instr)) {
      funde.push("instrumentation.ts: 'istEnger' führt nicht zu 'continue' — Riegel wirkungslos");
    }
  }
  // Der Take-Profit muss ausdrücklich mitgegeben werden (sonst hängt das
  // Ergebnis an einer undokumentierten Auslegung von Capital.com).
  if (/capitalUpdatePosition\([^)]*action\.new_sl,\s*undefined\)/.test(instr)) {
    funde.push("instrumentation.ts: Take-Profit wird als undefined übergeben statt mit dem echten Wert");
  }

  // ── Stelle 2: Trailing im RiskAgent ───────────────────────────────────────
  if (!/trailFallback/.test(risk)) {
    funde.push("risk-agent.ts: 'trailFallback' fehlt — Trailing vergleicht wieder nur gegen die eigene Erinnerung");
  } else if (!/isBuy\s*\?\s*Math\.max\(meta\.trailSL,\s*trailFallback\)\s*:\s*Math\.min\(meta\.trailSL,\s*trailFallback\)/.test(risk)) {
    funde.push("risk-agent.ts: Bezugspunkt fürs Trailing ist nicht mehr der ENGERE aus Erinnerung und Broker-Stop");
  }

  // ── Stelle 3: Breakeven im RiskAgent ──────────────────────────────────────
  if (!/alreadyAtBE/.test(risk)) {
    funde.push("risk-agent.ts: 'alreadyAtBE' fehlt — Breakeven könnte einen bereits enger gezogenen Stop zurückholen");
  } else if (!/beEffective\s*=\s*meta\.beSet\s*\|\|\s*alreadyAtBE/.test(risk)) {
    funde.push("risk-agent.ts: 'alreadyAtBE' fliesst nicht mehr in beEffective ein");
  }

  // ── Vollzähligkeit: gibt es eine VIERTE Schreibstelle ohne Riegel? ────────
  const stellen = (read("frontend/lib/agents/risk-agent.ts").match(/capitalUpdatePosition\(/g) || []).length
                + (instr.match(/capitalUpdatePosition\(sess/g) || []).length;
  // risk-agent: 1 Import + 2 Aufrufe = 3 Treffer; instrumentation: 1 Aufruf
  if (stellen > 4) {
    funde.push(`Es gibt ${stellen} Treffer auf capitalUpdatePosition (erwartet 4) — neue Schreibstelle ohne geprüften Riegel?`);
  }

  return { titel: "Stop-Riegel (3 Schreibstellen)", funde };
};
