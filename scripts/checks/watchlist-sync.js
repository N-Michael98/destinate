// PRÜFT: Alle Symbol-Listen im System sind deckungsgleich.
//
// WARUM: Am 03.08. wurde die Watchlist von 22 auf 30 erweitert. Sie existiert
// an vier Stellen plus zwei Nachschlagetabellen plus der Symbol-Auflösung im
// Python-Backend. Läuft eine davon auseinander, wird ein Markt entweder
// gehandelt ohne Backtest-Beleg, oder er fällt in Stufe 1 stillschweigend weg,
// weil INSTRUMENT_META ihn nicht kennt.
const { read, objectBlock } = require("./_lib");

// DJ30 hat nur vier Zeichen — ein Suchmuster mit Mindestlänge fünf hat es beim
// ersten Anlauf am 03.08. verschluckt und damit einen Index ungeprüft gelassen.
const SYM = /"([A-Z0-9]{4,7})"/g;

module.exports = function pruefe() {
  const funde = [];
  const orch = read("frontend/lib/agents/orchestrator-agent.ts");
  const scan = read("frontend/app/api/market-scanner/route.ts");
  const bt   = read("analysis-engine/services/backtest_engine.py");
  const cli  = read("frontend/lib/capital-com/capital-com-client.ts");
  const bk   = read("backend/services/market_data.py");

  const listeAus = (src, marker) => {
    const i = src.indexOf(marker);
    if (i < 0) return null;
    const start = src.indexOf("[", i);
    const ende = src.indexOf("]", start);
    return [...src.slice(start, ende).matchAll(SYM)].map((m) => m[1]);
  };

  const referenz = listeAus(orch, "const WATCHLIST = [");
  if (!referenz || referenz.length === 0) {
    return { titel: "Symbol-Listen", funde: ["orchestrator WATCHLIST nicht lesbar"] };
  }
  const basis = new Set(referenz);

  const listen = {
    "scanner WATCHLIST_SYMBOLS": listeAus(scan, "WATCHLIST_SYMBOLS = ["),
    "backtest WATCHLIST":        listeAus(bt, "\nWATCHLIST = ["),
    "EPIC_MAP":                  [...objectBlock(cli, "export const EPIC_MAP").matchAll(/^\s*([A-Z0-9]{4,7})\s*:/gm)].map((m) => m[1]),
  };
  for (const [name, liste] of Object.entries(listen)) {
    if (!liste) { funde.push(`${name}: nicht lesbar`); continue; }
    const s = new Set(liste);
    const fehlt = [...basis].filter((x) => !s.has(x));
    const zuviel = [...s].filter((x) => !basis.has(x));
    if (fehlt.length || zuviel.length) {
      funde.push(`${name}: fehlt [${fehlt.join(", ") || "-"}] zuviel [${zuviel.join(", ") || "-"}]`);
    }
  }

  // Beide INSTRUMENT_META müssen jedes Watchlist-Symbol kennen, sonst wird der
  // Markt beim Nachholen fehlender Kurse still verworfen.
  for (const [name, src] of [["orchestrator INSTRUMENT_META", orch], ["scanner META", scan]]) {
    const bekannt = new Set([...src.matchAll(/([A-Z0-9]{4,7})\s*:\s*\{\s*epic:/g)].map((m) => m[1]));
    const fehlt = [...basis].filter((x) => !bekannt.has(x));
    if (fehlt.length) funde.push(`${name}: kennt ${fehlt.join(", ")} nicht`);
  }

  // Python-Rückfall muss jedes Symbol auflösen können.
  const smap = new Set([...bk.matchAll(/"([A-Z0-9]{4,7})":\s*"/g)].map((m) => m[1]));
  const fehltPy = [...basis].filter((x) => !smap.has(x));
  if (fehltPy.length) funde.push(`backend SYMBOL_MAP: löst ${fehltPy.join(", ")} nicht auf`);

  return { titel: `Symbol-Listen (${basis.size} Symbole, 6 Stellen)`, funde };
};
