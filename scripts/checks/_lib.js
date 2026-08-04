// Gemeinsame Hilfsmittel für alle Regressionsprüfer.
//
// Bewusst OHNE jede Abhängigkeit: reines Node, keine Installation nötig.
// Jeder Prüfer meldet eine Liste von Befunden zurück; der Sammelrunner
// entscheidet über den Rückgabewert. Damit lässt sich das Ganze später
// unverändert in einen Git-Hook oder eine CI hängen.
const fs = require("fs");
const path = require("path");

/** Wurzel des Repositories — von scripts/checks/ aus zwei Ebenen hoch. */
const ROOT = path.resolve(__dirname, "..", "..");

/** Datei relativ zur Repo-Wurzel lesen. Wirft mit klarer Meldung, wenn sie fehlt. */
function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`Datei fehlt: ${rel}`);
  return fs.readFileSync(p, "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

/** Alle Quelldateien mit den angegebenen Endungen, ohne Fremd- und Bauordner. */
function sourceFiles(exts = [".ts", ".tsx", ".py"]) {
  const skip = new Set(["node_modules", ".next", ".git", "venv", "__pycache__", ".snapshots"]);
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (exts.includes(path.extname(e.name))) out.push(path.relative(ROOT, full).split("\\").join("/"));
    }
  })(ROOT);
  return out;
}

/**
 * Inhalt eines Objektliterals ab einem Suchbegriff, per Klammerzählung.
 * Verlässlicher als eine Regex, weil verschachtelte Klammern korrekt zählen.
 */
function objectBlock(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error(`nicht gefunden: ${marker}`);
  const open = src.indexOf("{", i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(open + 1, j); }
  }
  throw new Error(`Klammer nicht geschlossen: ${marker}`);
}

/** Schlüssel eines Objektblocks (Grossbuchstaben/Ziffern/Unterstrich). */
function keysOf(block) {
  return [...block.matchAll(/([A-Z0-9_]+)\s*:/g)].map((m) => m[1]);
}

module.exports = { ROOT, read, exists, sourceFiles, objectBlock, keysOf };
