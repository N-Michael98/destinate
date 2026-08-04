// PRÜFT: Beide Python-Dienste kompilieren, und die vorhandenen Tests laufen.
//
// WARUM: Beim ersten Bau des Regressionsnetzes am 03.08. wurden zwei von drei
// Diensten schlicht ausgelassen — `npm run check` blieb grün, obwohl niemand
// prüfte, ob backend/ und analysis-engine/ überhaupt übersetzbar sind.
//
// Ausserdem lagen in backend/tests/ neununddreissig fertige Testfunktionen, die
// NIE gelaufen sind: pytest stand zwar in requirements.txt, fehlte aber im
// lokalen venv. Beim ersten Lauf schlugen drei davon fehl.
//
// Fehlt pytest, wird das als BEFUND gemeldet und nicht still übersprungen —
// ein übersprungener Test sieht sonst aus wie ein bestandener.
//
// GRENZE, ehrlich benannt: py_compile findet SYNTAXFEHLER, aber keine
// Import-Fehler. Das lokale venv enthält nicht alle Pakete aus requirements.txt
// (pybreaker etwa fehlt), ein vollständiger Import-Test ist hier also gar nicht
// möglich. Ein fehlender Import fällt erst beim Start auf Railway auf. Wer das
// schliessen will, muss das venv vollständig einrichten — dann liesse sich der
// Prüfer um einen echten Import-Durchlauf erweitern.
const { ROOT, exists } = require("./_lib");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** Python-Interpreter: bevorzugt das venv des Backends, sonst der vom System. */
function interpreter() {
  const venv = path.join(ROOT, "backend", "venv", "Scripts", "python.exe");
  if (fs.existsSync(venv)) return venv;
  const venvNix = path.join(ROOT, "backend", "venv", "bin", "python");
  if (fs.existsSync(venvNix)) return venvNix;
  return "python";
}

function dateienVon(rel, unterordner) {
  const basis = path.join(ROOT, rel);
  const out = [];
  for (const u of unterordner) {
    const d = path.join(basis, u);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith(".py")) out.push(path.join(d, f));
    }
  }
  const haupt = path.join(basis, "main.py");
  if (fs.existsSync(haupt)) out.push(haupt);
  return out;
}

module.exports = function pruefe() {
  const funde = [];
  const py = interpreter();

  // ── Teil 1: Kompiliert beides? ────────────────────────────────────────────
  const gruppen = [
    ["backend", dateienVon("backend", ["services", "api/routes", "core"])],
    ["analysis-engine", dateienVon("analysis-engine", ["services", "api/routes", "core"])],
  ];
  let anzahl = 0;
  for (const [name, dateien] of gruppen) {
    if (dateien.length === 0) { funde.push(`${name}: keine Python-Dateien gefunden`); continue; }
    anzahl += dateien.length;
    try {
      execSync(`"${py}" -m py_compile ${dateien.map((d) => `"${d}"`).join(" ")}`, { stdio: "pipe" });
    } catch (e) {
      const meldung = (e.stderr?.toString() || e.message).split("\n").slice(0, 4).join(" ").trim();
      funde.push(`${name} kompiliert NICHT: ${meldung}`);
    }
  }

  // ── Teil 2: Laufen die vorhandenen Tests? ─────────────────────────────────
  let testZahl = 0;
  if (!exists("backend/tests/test_trading_functions.py")) {
    funde.push("backend/tests/test_trading_functions.py fehlt");
  } else {
    try {
      const aus = execSync(`"${py}" -m pytest tests/ -q --no-header -p no:warnings`, {
        cwd: path.join(ROOT, "backend"), stdio: "pipe", encoding: "utf8",
      });
      const m = aus.match(/(\d+) passed/);
      testZahl = m ? Number(m[1]) : 0;
      if (testZahl === 0) funde.push("pytest lief, meldet aber 0 bestandene Tests");
    } catch (e) {
      const aus = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
      if (/No module named pytest/i.test(aus)) {
        funde.push(`pytest nicht installiert — nachholen: "${py}" -m pip install pytest==8.3.4 pytest-asyncio==0.24.0`);
      } else {
        const zeilen = aus.split("\n").filter((z) => /^FAILED|^ERROR/.test(z));
        funde.push(...(zeilen.length ? zeilen.map((z) => `pytest: ${z.trim()}`) : [`pytest fehlgeschlagen: ${aus.split("\n").slice(-3).join(" ").trim()}`]));
      }
    }
  }

  return { titel: `Python-Dienste (${anzahl} Dateien kompiliert, ${testZahl} Tests)`, funde };
};
