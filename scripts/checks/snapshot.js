// SNAPSHOT-PRÜFER — hält kritische WERTE fest, nicht nur Strukturen.
//
// WARUM: Die anderen Prüfer sichern ab, dass ein Eintrag EXISTIERT. Sie merken
// nicht, wenn jemand seinen WERT ändert. Vorgeführt am 03.08.: MAX_SIZE für
// BTCUSD von 0.05 auf 5.0 gesetzt — das hundertfache Risiko — und das gesamte
// Netz blieb grün, weil der Schlüssel ja noch da war.
//
// Dieser Prüfer speichert die entscheidenden Zahlen und Texte und meldet jede
// Abweichung MIT der konkreten Differenz. Er verbietet Änderungen nicht, er
// erzwingt nur, dass sie bewusst bestätigt werden:
//
//     node scripts/checks/snapshot.js --update
//
// Die Snapshot-Datei gehört ins Repository. Eine Änderung daran ist im Diff
// sichtbar und muss im Commit begründet werden — genau das ist der Zweck.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT, read, objectBlock } = require("./_lib");

const DATEI = path.join(__dirname, "snapshots", "kritische-werte.json");

/** Zahlenwerte eines Objektliterals: { schluessel: Zahl, ... }
 *  KORREKTUR 03.08.: Das Muster verlangte zuerst nur GROSSBUCHSTABEN. Damit
 *  fielen ausgerechnet die Einstellungen durch (maxTradesPerDay,
 *  autoApproveThreshold, minConfidenceScore) und die AI-Grenzwerte — also
 *  genau die Zahlen, auf die es am meisten ankommt. Jetzt beide Schreibweisen.
 *  Kommentarzeilen werden vorher entfernt, damit Zahlen aus Erklärungen
 *  ("z.B. 0.5") nicht mitgelesen werden. */
function zahlen(block) {
  const ohneKommentare = block.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = {};
  for (const m of ohneKommentare.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:\s*(-?[0-9.]+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

/** Aktuellen Zustand aus den Quelldateien einsammeln. */
function erfasse() {
  const client   = read("frontend/lib/capital-com/capital-com-client.ts");
  const exec     = read("frontend/lib/capital-com/capital-com-execution.ts");
  const store    = read("frontend/lib/settings/settings-store.ts");
  const risk     = read("frontend/lib/agents/risk-agent.ts");
  const engine   = read("frontend/lib/market-scanner/ai-analysis-engine.ts");
  const filters  = read("frontend/lib/trading-filters/trade-filters.ts");
  const stopBlk  = objectBlock(exec, "const DEFAULT_STOP_BY_STYLE");

  // Der GPT-Prompt bestimmt Richtung, Stop und Ziel jedes Trades. Eine stille
  // Änderung daran ist die folgenreichste überhaupt — deshalb als Prüfsumme
  // über den Regelteil festgehalten, samt Zahl der Regelzeilen.
  const regelStart = engine.indexOf("CALIBRATION:");
  const regelEnde  = engine.indexOf("Return ONLY valid JSON");
  const regelText  = regelStart >= 0 && regelEnde > regelStart ? engine.slice(regelStart, regelEnde) : "";

  return {
    epicMap: Object.fromEntries(
      [...objectBlock(client, "export const EPIC_MAP").matchAll(/([A-Z0-9_]+)\s*:\s*"([A-Z0-9_]+)"/g)]
        .map((m) => [m[1], m[2]])
    ),
    minSize:        zahlen(objectBlock(exec, "const MIN_SIZE")),
    maxSize:        zahlen(objectBlock(exec, "const MAX_SIZE")),
    pipValue:       zahlen(objectBlock(exec, "const PIP_VALUE_PER_UNIT")),
    stopScalping:   zahlen(objectBlock(stopBlk, "SCALPING")),
    stopDaytrading: zahlen(objectBlock(stopBlk, "DAYTRADING")),
    stopSwing:      zahlen(objectBlock(stopBlk, "SWING")),
    botDefaults:    zahlen(objectBlock(store, "botSettings:")),
    riskDefaults:   zahlen(objectBlock(store, "riskSettings:")),
    // Exit-Schwellen des RiskAgent: Breakeven, Teilgewinn, Trailing, ATR-Faktor.
    // DAYTRADING steht als `default:`, nicht als `case` — beim ersten Anlauf
    // fehlte es deshalb und wäre ungeschützt geblieben.
    exitSchwellen: [...risk.matchAll(/(?:case "(\w+)"|(default)):\s*return \{ bePct: ([\d.]+), partialPct: ([\d.]+), trailPct: ([\d.]+), atrFactor: ([\d.]+) \}/g)]
      .reduce((a, m) => (a[m[1] ?? "DAYTRADING(default)"] = { bePct: +m[3], partialPct: +m[4], trailPct: +m[5], atrFactor: +m[6] }, a), {}),
    haltedauer: zahlen(objectBlock(risk, "const STYLE_MAX_HOURS")),
    // GRENZEN ist verschachtelt: { beBuffer: {min,max}, atrFactor: {min,max}, … }.
    // Eine flache Erfassung überschrieb min/max bei jeder Gruppe und behielt nur
    // die letzte — statt sechs Werten blieben zwei übrig, und die Klemmen für
    // Breakeven-Puffer und Trailing wären ungeschützt geblieben.
    aiGrenzen: [...objectBlock(risk, "const GRENZEN").matchAll(/(\w+):\s*\{\s*min:\s*(-?[\d.]+),\s*max:\s*(-?[\d.]+)/g)]
      .reduce((a, m) => (a[m[1]] = { min: +m[2], max: +m[3] }, a), {}),
    gptPrompt: {
      regelZeilen: (regelText.match(/^- /gm) || []).length,
      waitErwaehnungen: (regelText.match(/WAIT/g) || []).length,
      pruefsumme: crypto.createHash("sha256").update(regelText).digest("hex").slice(0, 16),
    },
    filterReihenfolge: [...filters.matchAll(/blockedBy:\s*"([A-Z_]+)"/g)].map((m) => m[1]),
  };
}

/** Zwei Zustände vergleichen und die konkreten Unterschiede benennen. */
function vergleiche(alt, neu, pfad = "") {
  const diffs = [];
  const schluessel = new Set([...Object.keys(alt ?? {}), ...Object.keys(neu ?? {})]);
  for (const k of schluessel) {
    const a = alt?.[k], n = neu?.[k];
    const p = pfad ? `${pfad}.${k}` : k;
    if (a !== null && typeof a === "object" && !Array.isArray(a)) { diffs.push(...vergleiche(a, n, p)); continue; }
    const as = JSON.stringify(a), ns = JSON.stringify(n);
    if (as !== ns) {
      if (a === undefined) diffs.push(`${p}: NEU = ${ns}`);
      else if (n === undefined) diffs.push(`${p}: ENTFERNT (war ${as})`);
      else diffs.push(`${p}: ${as} → ${ns}`);
    }
  }
  return diffs;
}

module.exports = function pruefe() {
  const aktuell = erfasse();
  // Blattwerte zählen, nicht nur die oberste Ebene: aiGrenzen und
  // exitSchwellen sind verschachtelt, eine flache Zählung meldete 246 statt
  // 258 und stimmte damit nicht mit der eigenen Dokumentation überein.
  const zaehle = (v) =>
    Array.isArray(v) ? v.length
    : v !== null && typeof v === "object" ? Object.values(v).reduce((n, x) => n + zaehle(x), 0)
    : 1;
  const anzahl = zaehle(aktuell);

  if (!fs.existsSync(DATEI)) {
    return { titel: "Snapshot kritischer Werte", funde: [`Kein Snapshot vorhanden — anlegen mit: node scripts/checks/snapshot.js --update`] };
  }
  const gespeichert = JSON.parse(fs.readFileSync(DATEI, "utf8"));
  const diffs = vergleiche(gespeichert.werte, aktuell);

  if (diffs.length > 0) {
    return {
      titel: `Snapshot kritischer Werte (${anzahl} Werte, Stand ${gespeichert.erstelltAm?.slice(0, 10) ?? "?"})`,
      funde: [
        ...diffs.slice(0, 20).map((d) => `WERT GEÄNDERT: ${d}`),
        ...(diffs.length > 20 ? [`… und ${diffs.length - 20} weitere`] : []),
        "Wenn beabsichtigt: node scripts/checks/snapshot.js --update  (Änderung wird im Diff sichtbar)",
      ],
    };
  }
  return { titel: `Snapshot kritischer Werte (${anzahl} Werte unverändert)`, funde: [] };
};

// ── Direktaufruf: Snapshot neu schreiben ────────────────────────────────────
if (require.main === module) {
  if (process.argv[2] !== "--update") {
    console.log("Aufruf: node scripts/checks/snapshot.js --update");
    process.exit(1);
  }
  const werte = erfasse();
  fs.mkdirSync(path.dirname(DATEI), { recursive: true });
  const vorher = fs.existsSync(DATEI) ? JSON.parse(fs.readFileSync(DATEI, "utf8")).werte : null;
  fs.writeFileSync(DATEI, JSON.stringify({
    hinweis: "Von scripts/checks/snapshot.js erzeugt. Nicht von Hand ändern — mit --update neu schreiben.",
    erstelltAm: new Date().toISOString(),
    werte,
  }, null, 2) + "\n", "utf8");
  const diffs = vorher ? vergleiche(vorher, werte) : [];
  console.log(`Snapshot geschrieben: ${path.relative(ROOT, DATEI)}`);
  if (diffs.length) {
    console.log("Übernommene Änderungen:");
    for (const d of diffs) console.log("  " + d);
  }
}
