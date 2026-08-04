// PRÜFT: Jeder Aufruf ans Python-Backend trägt den Auth-Header.
//
// WARUM: Ein fehlender Header ergibt HTTP 401. Genau das lief bei
// exquisite-rejoicing tagelang alle zwei Minuten auf, ohne dass es jemandem
// auffiel, weil die Aufrufe im Fehlerfall still zurückgaben.
//
// Ausgenommen sind bewusst offene Pfade: /health und / sind ungeschützt, damit
// UptimeRobot sie erreichen kann (backend/main.py: der Wächter greift nur für
// Pfade, die mit /api/ beginnen).
const { read, sourceFiles } = require("./_lib");

const OFFEN = [/\/health/, /\$\{PYTHON_BASE\}\/?["`]/];

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;

  for (const datei of sourceFiles([".ts", ".tsx"]).filter((f) => f.startsWith("frontend/"))) {
    const src = read(datei);
    if (!/PYTHON_BASE|PYTHON_BACKEND/.test(src)) continue;
    const zeilen = src.split("\n");
    for (let i = 0; i < zeilen.length; i++) {
      if (!/fetch\(\s*`\$\{PYTHON_BASE\}/.test(zeilen[i])) continue;
      geprueft++;
      if (OFFEN.some((r) => r.test(zeilen[i]))) continue;
      // Aufrufblock: bis zu zwölf Zeilen ab dem fetch — deckt die
      // Optionen-Objekte in diesem Projekt zuverlässig ab.
      const block = zeilen.slice(i, i + 12).join("\n");
      if (!/pythonBackendAuthHeader|X-Backend-Key/.test(block)) {
        funde.push(`${datei}:${i + 1} ohne Auth-Header`);
      }
    }
  }

  if (geprueft === 0) funde.push("kein einziger Python-Aufruf gefunden — Prüfmuster stimmt nicht mehr");

  return { titel: `Backend-Authentifizierung (${geprueft} Aufrufe)`, funde };
};
