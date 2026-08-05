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
// Import-Fehler. Vom lokalen venv fehlten am 05.08. 17 von 32 Paketen aus
// requirements.txt — ein echter Import-Durchlauf ist hier also gar nicht
// möglich. Aufgefallen ist das erst, als ein Test trading_strategies.py
// importieren wollte und an tenacity scheiterte, WÄHREND dieser Prüfer grün
// meldete.
//
// Teil 3 schliesst davon den Teil, der in Produktion wirklich weh tut: ein
// Import, den NIEMAND installiert. Das ist statisch prüfbar und braucht kein
// vollständiges venv. Was weiterhin offen bleibt: ein Paket, das zwar
// deklariert ist, dessen Import aber aus anderem Grund scheitert (falsche
// Version, fehlende Systembibliothek) — das zeigt sich erst beim Start.
const { ROOT, exists } = require("./_lib");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ACHTUNG, gemessen am 05.08.: lokal laeuft Python 3.14.5, im Betrieb aber
// 3.11 (beide Dockerfiles: FROM python:3.11-slim). Fuer DIESE Liste ist das
// derzeit folgenlos — die stdlib-Namen beider Versionen stimmen in allen 194
// Eintraegen ueberein, nachgerechnet. Fuer den Rest des Systems ist es eine
// echte Abweichung: was lokal laeuft, ist nicht die Version, die handelt.
// Wird die Liste neu erzeugt, muss dieser Abgleich wiederholt werden.
//
// Standardbibliothek von Python 3.14 — erzeugt mit
// `python -c "import sys; print(sorted(sys.stdlib_module_names))"`, nicht von Hand
// gepflegt. Diese Namen sind immer da und brauchen keinen Eintrag in
// requirements.txt.
const STDLIB = new Set([
  "abc", "annotationlib", "antigravity", "argparse", "array", "ast", "asyncio", "atexit",
  "base64", "bdb", "binascii", "bisect", "builtins", "bz2", "cProfile", "calendar", "cmath",
  "cmd", "code", "codecs", "codeop", "collections", "colorsys", "compileall", "compression",
  "concurrent", "configparser", "contextlib", "contextvars", "copy", "copyreg", "csv",
  "ctypes", "curses", "dataclasses", "datetime", "dbm", "decimal", "difflib", "dis", "doctest",
  "email", "encodings", "ensurepip", "enum", "errno", "faulthandler", "fcntl", "filecmp",
  "fileinput", "fnmatch", "fractions", "ftplib", "functools", "gc", "genericpath", "getopt",
  "getpass", "gettext", "glob", "graphlib", "grp", "gzip", "hashlib", "heapq", "hmac", "html",
  "http", "idlelib", "imaplib", "importlib", "inspect", "io", "ipaddress", "itertools", "json",
  "keyword", "linecache", "locale", "logging", "lzma", "mailbox", "marshal", "math",
  "mimetypes", "mmap", "modulefinder", "msvcrt", "multiprocessing", "netrc", "nt", "ntpath",
  "nturl2path", "numbers", "opcode", "operator", "optparse", "os", "pathlib", "pdb", "pickle",
  "pickletools", "pkgutil", "platform", "plistlib", "poplib", "posix", "posixpath", "pprint",
  "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr", "pydoc", "pydoc_data", "pyexpat",
  "queue", "quopri", "random", "re", "readline", "reprlib", "resource", "rlcompleter", "runpy",
  "sched", "secrets", "select", "selectors", "shelve", "shlex", "shutil", "signal", "site",
  "smtplib", "socket", "socketserver", "sqlite3", "sre_compile", "sre_constants", "sre_parse",
  "ssl", "stat", "statistics", "string", "stringprep", "struct", "subprocess", "symtable",
  "sys", "sysconfig", "syslog", "tabnanny", "tarfile", "tempfile", "termios", "textwrap",
  "this", "threading", "time", "timeit", "tkinter", "token", "tokenize", "tomllib", "trace",
  "traceback", "tracemalloc", "tty", "turtle", "turtledemo", "types", "typing", "unicodedata",
  "unittest", "urllib", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser", "winreg",
  "winsound", "wsgiref", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo"
]);

// Eigene Pakete der Dienste — ebenfalls kein Fremd-Import.
const LOKAL = new Set(["services", "core", "api", "models", "config", "utils",
  "main", "routers", "schemas", "db", "tests"]);

// Import-Name != Paketname. Nur Faelle, die in diesem Repo wirklich vorkommen,
// plus die gaengigsten Stolpersteine — geraten wird hier nichts.
const IMPORT_ALIAS = {
  sklearn: "scikit-learn", psycopg2: "psycopg2-binary", pydantic_settings: "pydantic-settings",
  newspaper: "newspaper3k", talib: "TA-Lib", dotenv: "python-dotenv",
  telegram: "python-telegram-bot", yaml: "PyYAML", dateutil: "python-dateutil",
  PIL: "Pillow", cv2: "opencv-python", attr: "attrs", jwt: "PyJWT",
};

/** Paketnamen vergleichbar machen: Gross/Klein und -/_ sind in pip gleichwertig. */
function normPaket(name) {
  return String(name).trim().toLowerCase().replace(/_/g, "-");
}

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

  // ── Teil 3: Ist jeder Fremd-Import auch installiert? ──────────────────────
  // Verglichen wird gegen ZWEI Quellen, nicht nur requirements.txt:
  // TA-Lib etwa steht bewusst NICHT dort — es braucht erst die C-Bibliothek aus
  // vendor/, wird deshalb im Dockerfile mit einer eigenen pip-Zeile installiert.
  // Ein Prüfer, der nur requirements.txt liest, meldet das als Fehlalarm.
  let importZahl = 0;
  for (const [dienst] of gruppen) {
    const dateien = dateienVon(dienst, ["services", "api/routes", "core"]);
    if (dateien.length === 0) continue;

    const deklariert = new Set();
    const anforderungen = path.join(ROOT, dienst, "requirements.txt");
    if (!fs.existsSync(anforderungen)) {
      funde.push(`${dienst}/requirements.txt fehlt — Importe nicht prüfbar`);
      continue;
    }
    for (const z of fs.readFileSync(anforderungen, "utf8").split(/\r?\n/)) {
      const rein = z.split("#")[0].trim();
      if (rein && !rein.startsWith("-")) deklariert.add(normPaket(rein.split(/[=<>!\[;]/)[0]));
    }
    const docker = path.join(ROOT, dienst, "Dockerfile");
    if (fs.existsSync(docker)) {
      for (const m of fs.readFileSync(docker, "utf8").matchAll(/pip install[^\r\n]*/g)) {
        for (const w of m[0].split(/\s+/)) {
          if (/^[A-Za-z][\w.-]*$/.test(w) && !["pip","install","cache","dir","only","binary","all"].includes(w)) {
            deklariert.add(normPaket(w));
          }
        }
      }
    }

    const gesehen = new Map();
    for (const datei of dateien) {
      for (const z of fs.readFileSync(datei, "utf8").split(/\r?\n/)) {
        const m = z.match(/^\s*(?:from|import)\s+([A-Za-z_][\w.]*)/);
        if (!m) continue;
        const wurzel = m[1].split(".")[0];
        if (LOKAL.has(wurzel) || STDLIB.has(wurzel)) continue;
        if (!gesehen.has(wurzel)) gesehen.set(wurzel, path.basename(datei));
      }
    }
    importZahl += gesehen.size;
    for (const [name, wo] of gesehen) {
      const paket = normPaket(IMPORT_ALIAS[name] ?? name);
      if (!deklariert.has(paket)) {
        funde.push(`${dienst}: "import ${name}" (${wo}) — Paket "${paket}" steht weder in requirements.txt noch im Dockerfile`);
      }
    }
  }

  return { titel: `Python-Dienste (${anzahl} Dateien kompiliert, ${testZahl} Tests, ${importZahl} Importe)`, funde };
};
