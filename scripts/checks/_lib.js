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

/** Übersetzt eine TypeScript-Datei und führt sie mit gestellten Importen aus.
 *
 *  WOZU. Die Prüfer sehen sonst nur STRUKTUR — ob ein Riegel dasteht. Ob er
 *  RICHTIG rechnet, sieht keiner. Vorgeführt am 10.08.: die AI-Klemme liess
 *  sich auf `return n;` reduzieren (also vollständig entfernen) und ai-clamp
 *  blieb grün, weil dieser Prüfer eine eigene KOPIE der Klemme testete statt
 *  der echten. Ein Nachbau prüft sich selbst.
 *
 *  Das Projekt hat keinen TypeScript-Testläufer (kein jest, kein vitest, kein
 *  tsx). Deshalb dieser Weg: TypeScripts eigener Transpiler, danach ausführen
 *  mit einem gestellten require. Damit läuft der ECHTE Quelltext.
 *
 *  "then" muss beim Stellvertreter undefined bleiben, sonst hält ein await ihn
 *  für ein Promise, ruft dessen then() auf und der Prüfer hängt still.
 *
 *  @param relPfad  Pfad ab frontend/, z.B. "lib/agents/risk-agent.ts"
 *  @returns { exports } oder { fehler } — nie ein Wurf, damit ein Prüfer
 *           daraus einen Befund machen kann statt abzustürzen.
 */
function ladeTsModul(relPfad) {
  const tsPfad = path.join(ROOT, "frontend", "node_modules", "typescript");
  if (!fs.existsSync(tsPfad)) {
    return { fehler: "typescript nicht gefunden — nachholen: cd frontend && npm install" };
  }
  const datei = path.join(ROOT, "frontend", relPfad);
  if (!fs.existsSync(datei)) return { fehler: `${relPfad} existiert nicht` };
  try {
    const ts = require(tsPfad);
    const js = ts.transpileModule(fs.readFileSync(datei, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const modul = { exports: {} };
    const stellvertreter = () => new Proxy(function () {}, {
      get: (_z, prop) => (prop === "then" || typeof prop === "symbol" ? undefined : stellvertreter()),
      apply: () => { throw new Error("keine Aussenwelt im Prüfstand"); },
      construct: () => ({}),
    });
    new Function("exports", "require", "module", "__filename", "__dirname", js)(
      modul.exports, stellvertreter, modul, datei, path.dirname(datei));
    return { exports: modul.exports };
  } catch (e) {
    return { fehler: `${relPfad} liess sich nicht ausführen: ${e.message}` };
  }
}

module.exports = { ROOT, read, exists, sourceFiles, objectBlock, keysOf, ladeTsModul };
