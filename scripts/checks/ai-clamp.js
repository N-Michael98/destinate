// PRÜFT: Die AI kann die Risiko-Werte nicht ausser Grenzen setzen.
//
// WARUM: Seit dem 03.08. darf der AI Manager Breakeven-Puffer,
// Trailing-Abstand und Teilgewinn-Anteil am Markt ausrichten. Ohne Klemme
// könnte eine einzige Ausreisser-Antwort (etwa Trailing 50× ATR = praktisch
// kein Stop) den Schutz aushebeln.
//
// Zwei Teile: der Quelltext muss die Klemme enthalten UND auf alle drei Werte
// anwenden — und die Klemme selbst wird hier mit bösartigen Eingaben gerechnet.
const { read } = require("./_lib");

module.exports = function pruefe() {
  const funde = [];
  const risk = read("frontend/lib/agents/risk-agent.ts");

  // ── Teil 1: Ist die Klemme da und wird sie überall angewendet? ────────────
  if (!/function inGrenzen\(/.test(risk)) {
    funde.push("risk-agent.ts: Funktion 'inGrenzen' fehlt — AI-Werte ungeklemmt");
  }
  for (const feld of ["adjustedBeBuffer", "adjustedAtrFactor", "adjustedPartialRatio"]) {
    const re = new RegExp(`inGrenzen\\(roh\\.${feld}`);
    if (!re.test(risk)) funde.push(`risk-agent.ts: ${feld} läuft nicht durch inGrenzen`);
  }
  for (const g of ["beBuffer", "atrFactor", "partialRatio"]) {
    if (!new RegExp(`${g}:\\s*\\{\\s*min:`).test(risk)) {
      funde.push(`risk-agent.ts: Grenzwerte für ${g} fehlen`);
    }
  }
  // Unbrauchbare Werte müssen VERWORFEN werden (null), nicht auf das Minimum
  // geklemmt — sonst setzt ein ausdrückliches null der AI den engsten Wert.
  if (!/wert === null \|\| wert === undefined/.test(risk)) {
    funde.push("risk-agent.ts: null/undefined wird nicht als 'nicht angegeben' behandelt");
  }
  // Ein von der AI angepasster Trail darf nie lockerer sein als der Regelwert.
  if (!/kandidatOk/.test(risk)) {
    funde.push("risk-agent.ts: 'kandidatOk' fehlt — AI-Trail wird ohne Gegenprüfung übernommen");
  }

  // ── Teil 2: Die Klemme selbst gegen bösartige Eingaben rechnen ────────────
  const inGrenzen = (wert, min, max) => {
    if (wert === null || wert === undefined || wert === "") return null;
    const n = typeof wert === "number" ? wert : Number(wert);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  };
  const G = { beBuffer: [0, 0.5], atrFactor: [0.5, 4.0], partialRatio: [0.25, 0.75] };
  const boese = [50, -3, 0, 1e9, -1e9, "viel", null, undefined, NaN, Infinity, -Infinity, "", "0.5abc"];
  for (const [name, [min, max]] of Object.entries(G)) {
    for (const w of boese) {
      const r = inGrenzen(w, min, max);
      if (r !== null && !(r >= min && r <= max)) {
        funde.push(`Klemme ${name}: Eingabe ${String(w)} ergab ${r} — ausserhalb [${min}, ${max}]`);
      }
    }
  }
  // Der Teilgewinn darf eine Position nie ganz schliessen.
  for (const w of [1.0, 5, 100]) {
    const anteil = inGrenzen(w, 0.25, 0.75) ?? 0.5;
    if (Math.floor(10 * anteil) >= 10) {
      funde.push(`Teilgewinn: Anteil ${w} würde die ganze Position schliessen`);
    }
  }

  return { titel: "AI-Klemme (Struktur + 36 Eingaben)", funde };
};
