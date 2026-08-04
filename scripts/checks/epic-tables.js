// PRÜFT: Jedes Epic aus EPIC_MAP hat einen Eintrag in ALLEN sechs
// grössen- und stopbestimmenden Tabellen, und beide INSTRUMENT_META
// nennen dasselbe Epic wie die EPIC_MAP.
//
// WARUM: Am 03.08. wurden zwölf falsche Epic-Namen korrigiert. Dabei zeigte
// sich, wie leicht die nächste Lücke entsteht — das Epic ist Schlüssel in
// sechs weiteren Tabellen. Wird eine vergessen, greift bei genau diesem Markt
// die MAX_SIZE-Klemme nicht mehr, und die Position könnte um ein Vielfaches
// zu gross werden, ohne dass irgendetwas fehlschlägt.
const { read, objectBlock, keysOf } = require("./_lib");

module.exports = function pruefe() {
  const funde = [];
  const client = read("frontend/lib/capital-com/capital-com-client.ts");
  const exec   = read("frontend/lib/capital-com/capital-com-execution.ts");
  const orch   = read("frontend/lib/agents/orchestrator-agent.ts");
  const scan   = read("frontend/app/api/market-scanner/route.ts");

  const epics = [...objectBlock(client, "export const EPIC_MAP")
    .matchAll(/([A-Z0-9_]+)\s*:\s*"([A-Z0-9_]+)"/g)]
    .map((m) => ({ sym: m[1], epic: m[2] }));

  if (epics.length === 0) funde.push("EPIC_MAP konnte nicht gelesen werden");

  const stop = objectBlock(exec, "const DEFAULT_STOP_BY_STYLE");
  const tabellen = {
    MIN_SIZE:           keysOf(objectBlock(exec, "const MIN_SIZE")),
    PIP_VALUE_PER_UNIT: keysOf(objectBlock(exec, "const PIP_VALUE_PER_UNIT")),
    MAX_SIZE:           keysOf(objectBlock(exec, "const MAX_SIZE")),
    STOP_SCALPING:      keysOf(objectBlock(stop, "SCALPING")),
    STOP_DAYTRADING:    keysOf(objectBlock(stop, "DAYTRADING")),
    STOP_SWING:         keysOf(objectBlock(stop, "SWING")),
  };

  for (const [name, keys] of Object.entries(tabellen)) {
    const fehlt = epics.filter((e) => !keys.includes(e.epic));
    if (fehlt.length) {
      funde.push(`${name}: ${fehlt.map((e) => `${e.sym}(${e.epic})`).join(", ")} fehlt`);
    }
  }

  const emap = Object.fromEntries(epics.map((e) => [e.sym, e.epic]));
  for (const [name, src] of [["orchestrator INSTRUMENT_META", orch], ["market-scanner META", scan]]) {
    const paare = [...src.matchAll(/([A-Z0-9]+)\s*:\s*\{\s*epic:\s*"([A-Z0-9_]+)"/g)];
    if (paare.length === 0) { funde.push(`${name}: keine Einträge gefunden`); continue; }
    for (const p of paare) {
      if (emap[p[1]] && emap[p[1]] !== p[2]) {
        funde.push(`${name}: ${p[1]} hat "${p[2]}" statt "${emap[p[1]]}"`);
      }
    }
  }

  return { titel: `Epic-Tabellen (${epics.length} Epics × 6 Tabellen + 2 META)`, funde };
};
