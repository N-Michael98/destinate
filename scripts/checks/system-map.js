#!/usr/bin/env node
// SYSTEM-KARTE — welche Datei hängt an welcher, direkt aus dem Code gelesen.
//
// WARUM: Wiederkehrendes Problem — eine Datei wird geändert, ohne zu wissen,
// dass zwei andere davon abhängen. Eine von Hand gepflegte Karte hilft dabei
// nicht, weil sie ab dem ersten Commit veraltet; eine falsche Karte ist
// schlimmer als keine, weil sie falsches Vertrauen erzeugt. Deshalb wird der
// Graph aus den Importen erzeugt und bei jedem Lauf gegen den Code geprüft.
//
// EHRLICHE ABGRENZUNG: Die Karte zeigt, WER WEN AUFRUFT. Sie hätte weder die
// falschen Epic-Namen gefunden (Kopplung über Werte, nicht über Importe) noch
// das an einem erfundenen Kurs geprüfte Chance-Risiko (innerhalb einer Datei)
// noch das WAIT-Problem (Prompt-Text). Dafür sind die anderen Prüfer da. Sie
// ergänzt sie, sie ersetzt sie nicht.
//
// Aufruf:
//   node scripts/checks/system-map.js --impact lib/agents/risk-agent.ts
//   node scripts/checks/system-map.js --update
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./_lib");

const DATEI = path.join(ROOT, "SYSTEM_MAP.md");
const UEBERSPRINGEN = new Set(["node_modules", ".next", ".git", "venv", "__pycache__", ".snapshots"]);

/** Alle eigenen Quelldateien, repo-relativ mit Schrägstrichen. */
function quelldateien() {
  const out = [];
  (function lauf(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (UEBERSPRINGEN.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) lauf(p);
      else if (/\.(ts|tsx|py)$/.test(e.name)) out.push(path.relative(ROOT, p).split("\\").join("/"));
    }
  })(ROOT);
  return out.sort();
}

const existiert = (rel) => fs.existsSync(path.join(ROOT, rel));

/**
 * Import-Angabe zu einem Dateipfad auflösen.
 * Gibt null zurück für Fremdpakete — die gehören nicht in unsere Karte.
 */
function aufloesen(vonDatei, angabe) {
  const dir = path.posix.dirname(vonDatei);

  // TypeScript: relative Angaben und das Kürzel @/ (tsconfig: "@/*" -> "./*",
  // bezogen auf den Ordner frontend/)
  if (angabe.startsWith(".") || angabe.startsWith("@/")) {
    const basis = angabe.startsWith("@/")
      ? path.posix.join("frontend", angabe.slice(2))
      : path.posix.normalize(path.posix.join(dir, angabe));
    for (const k of [".ts", ".tsx", "/index.ts", "/index.tsx", ".js", ""]) {
      if (k === "" ? existiert(basis) && /\.(ts|tsx)$/.test(basis) : existiert(basis + k)) {
        return k === "" ? basis : basis + k;
      }
    }
    return null;
  }

  // Python: from services.x / core.x / api.x — der Dienst ergibt sich aus dem
  // Ordner der importierenden Datei (backend/ oder analysis-engine/).
  const dienst = vonDatei.startsWith("backend/") ? "backend"
    : vonDatei.startsWith("analysis-engine/") ? "analysis-engine" : null;
  if (dienst && /^(services|core|api)[./]/.test(angabe)) {
    const ziel = `${dienst}/${angabe.replace(/\./g, "/")}.py`;
    if (existiert(ziel)) return ziel;
    const alsPaket = `${dienst}/${angabe.replace(/\./g, "/")}/__init__.py`;
    if (existiert(alsPaket)) return alsPaket;
  }
  return null;
}

/** Kanten sammeln: von welcher Datei geht welcher interne Import aus? */
function sammleGraph() {
  const kanten = new Map();      // datei -> Set(importierte dateien)
  const dateien = quelldateien();
  let roh = 0;

  for (const datei of dateien) {
    const src = fs.readFileSync(path.join(ROOT, datei), "utf8");
    const ziele = new Set();
    const nimm = (angabe) => {
      roh++;
      const z = aufloesen(datei, angabe);
      if (z && z !== datei) ziele.add(z);
    };

    if (/\.(ts|tsx)$/.test(datei)) {
      // Statisch: import ... from "x"  /  export ... from "x"
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s+["']([^"']+)["']/g)) nimm(m[1]);
      // Nebenwirkungs-Import: import "x"
      for (const m of src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) nimm(m[1]);
      // Dynamisch: import("x") — davon gibt es hier über neunzig, und
      // ausgerechnet die Kette Orchestrator -> RiskAgent laeuft darueber.
      // Wer sie weglaesst, bekommt eine Karte, die luegt.
      for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) nimm(m[1]);
      // require("x")
      for (const m of src.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) nimm(m[1]);
    } else {
      for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import/gm)) nimm(m[1]);
      for (const m of src.matchAll(/^\s*import\s+([\w.]+)/gm)) nimm(m[1]);
    }
    kanten.set(datei, ziele);
  }
  return { kanten, dateien, roh };
}

/** Umgekehrter Index: wer benutzt diese Datei? */
function rueckwaerts(kanten) {
  const r = new Map();
  for (const [von, ziele] of kanten) {
    for (const z of ziele) {
      if (!r.has(z)) r.set(z, new Set());
      r.get(z).add(von);
    }
  }
  return r;
}

/** Alle, die direkt oder über Umwege von `start` abhängen. */
function betroffene(rueck, start) {
  const gesehen = new Set();
  const ebenen = [];
  let aktuell = new Set(rueck.get(start) ?? []);
  while (aktuell.size > 0 && ebenen.length < 8) {
    const neu = new Set();
    for (const d of aktuell) {
      if (gesehen.has(d)) continue;
      gesehen.add(d);
      for (const w of rueck.get(d) ?? []) if (!gesehen.has(w)) neu.add(w);
    }
    ebenen.push([...aktuell].filter((d) => gesehen.has(d)).sort());
    aktuell = neu;
  }
  return ebenen;
}

/** Welche Prüfer erwähnen diese Datei? */
function pruefer(datei) {
  const dir = path.join(ROOT, "scripts", "checks");
  const kurz = datei.split("/").pop().replace(/\.(ts|tsx|py)$/, "");
  const treffer = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".js") || f === "run-all.js" || f === "_lib.js" || f === "system-map.js") continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (src.includes(datei) || src.includes(kurz)) treffer.push(f.replace(".js", ""));
  }
  return treffer;
}

/** Inhalt der Karte erzeugen — sortiert, damit Unterschiede aussagekräftig sind. */
function karteErzeugen(graph) {
  const { kanten } = graph;
  const rueck = rueckwaerts(kanten);
  const mitKanten = [...kanten.entries()].filter(([, z]) => z.size > 0).sort();

  const zeilen = [];
  zeilen.push("# System-Karte");
  zeilen.push("");
  zeilen.push("**Erzeugt von `scripts/checks/system-map.js` — nicht von Hand ändern.**");
  zeilen.push("Neu erzeugen: `node scripts/checks/system-map.js --update`");
  zeilen.push("");
  zeilen.push("Sie zeigt, **wer wen aufruft** — gelesen aus den Importen im Code, statische");
  zeilen.push("und dynamische. Sie zeigt NICHT, welche Dateien über gemeinsame *Werte* oder");
  zeilen.push("gemeinsame *Ressourcen* gekoppelt sind; dafür sind die übrigen Prüfer da.");
  zeilen.push("");
  zeilen.push("Vor einer Änderung: `node scripts/checks/system-map.js --impact <datei>`");
  zeilen.push("");
  zeilen.push(`Dateien mit internen Abhängigkeiten: ${mitKanten.length} · Kanten: ${mitKanten.reduce((n, [, z]) => n + z.size, 0)}`);
  zeilen.push("");

  let letzterOrdner = "";
  for (const [datei, ziele] of mitKanten) {
    const ordner = datei.split("/").slice(0, 2).join("/");
    if (ordner !== letzterOrdner) { zeilen.push(""); zeilen.push(`## ${ordner}`); zeilen.push(""); letzterOrdner = ordner; }
    zeilen.push(`- \`${datei}\``);
    for (const z of [...ziele].sort()) zeilen.push(`  - → \`${z}\``);
  }

  // Wer wird am häufigsten benutzt? Diese Dateien brechen am meisten, wenn sie kippen.
  const top = [...rueck.entries()].map(([d, s]) => [d, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 15);
  zeilen.push("");
  zeilen.push("## Am häufigsten benutzt (Änderung hier trifft am meisten)");
  zeilen.push("");
  for (const [d, n] of top) zeilen.push(`- \`${d}\` — von ${n} Dateien`);
  zeilen.push("");
  return zeilen.join("\n");
}

// ── Als Prüfer ──────────────────────────────────────────────────────────────
module.exports = function pruefe() {
  const graph = sammleGraph();
  const soll = karteErzeugen(graph);
  const kanten = [...graph.kanten.values()].reduce((n, z) => n + z.size, 0);

  if (!fs.existsSync(DATEI)) {
    return { titel: "System-Karte", funde: ["SYSTEM_MAP.md fehlt — erzeugen mit: node scripts/checks/system-map.js --update"] };
  }
  const ist = fs.readFileSync(DATEI, "utf8");
  if (ist.trim() !== soll.trim()) {
    // Konkrete Unterschiede als PAARE (Quelle → Ziel) benennen, nicht als
    // einzelne Zeilen: dasselbe Ziel steht unter vielen Quellen, ein reiner
    // Zeilenvergleich hätte eine neue Kante deshalb übersehen und nur
    // "irgendwas ist anders" gemeldet. Genau das ist beim Sabotage-Test
    // aufgefallen.
    const paare = (text) => {
      const s = new Set();
      let quelle = "";
      for (const z of text.split("\n")) {
        const q = z.match(/^- `([^`]+)`/);
        if (q) { quelle = q[1]; continue; }
        const t = z.match(/^  - → `([^`]+)`/);
        if (t && quelle) s.add(`${quelle} → ${t[1]}`);
      }
      return s;
    };
    const a = paare(ist), b = paare(soll);
    const neu = [...b].filter((p) => !a.has(p)).sort();
    const weg = [...a].filter((p) => !b.has(p)).sort();
    const funde = [
      ...neu.slice(0, 8).map((p) => `NEUE Abhängigkeit: ${p}`),
      ...weg.slice(0, 8).map((p) => `ENTFERNTE Abhängigkeit: ${p}`),
    ];
    if (neu.length + weg.length > 16) funde.push(`… und ${neu.length + weg.length - 16} weitere`);
    if (funde.length === 0) funde.push("Karte weicht ab, ohne dass sich eine Kante geändert hat (Zählwerte/Kopf) — Karte ist veraltet");
    funde.push("Neu erzeugen: node scripts/checks/system-map.js --update");
    return { titel: `System-Karte (${kanten} Kanten)`, funde };
  }
  return { titel: `System-Karte (${kanten} Kanten, unverändert)`, funde: [] };
};

// ── Direktaufruf ────────────────────────────────────────────────────────────
if (require.main === module) {
  const modus = process.argv[2];

  if (modus === "--update") {
    const graph = sammleGraph();
    fs.writeFileSync(DATEI, karteErzeugen(graph) + "\n", "utf8");
    const kanten = [...graph.kanten.values()].reduce((n, z) => n + z.size, 0);
    console.log(`SYSTEM_MAP.md geschrieben — ${graph.dateien.length} Dateien, ${kanten} interne Kanten (aus ${graph.roh} Import-Angaben).`);
    process.exit(0);
  }

  if (modus === "--impact") {
    let ziel = (process.argv[3] || "").split("\\").join("/").replace(/^\.\//, "");
    if (!ziel) { console.log("Aufruf: node scripts/checks/system-map.js --impact <datei>"); process.exit(1); }
    const graph = sammleGraph();
    // Bequemlichkeit: Pfad ohne führendes frontend/ wird ergänzt.
    if (!graph.kanten.has(ziel)) {
      const kandidat = [...graph.kanten.keys()].filter((d) => d.endsWith("/" + ziel) || d.endsWith(ziel));
      if (kandidat.length === 1) ziel = kandidat[0];
      else if (kandidat.length > 1) { console.log("Mehrdeutig:\n  " + kandidat.join("\n  ")); process.exit(1); }
      else { console.log(`Datei nicht gefunden: ${ziel}`); process.exit(1); }
    }
    const rueck = rueckwaerts(graph.kanten);
    const ebenen = betroffene(rueck, ziel);

    console.log("\n" + "─".repeat(64));
    console.log(`  AUSWIRKUNG: ${ziel}`);
    console.log("─".repeat(64));
    console.log("\n  WIRD BENUTZT VON:");
    if (ebenen.length === 0) console.log("     (niemand — diese Datei ist ein Endpunkt)");
    ebenen.forEach((e, i) => {
      console.log(`     ${i === 0 ? "direkt" : `über ${i} Ecke${i > 1 ? "n" : ""}`}:`);
      for (const d of e) console.log(`       ← ${d}`);
    });
    const eigene = [...(graph.kanten.get(ziel) ?? [])].sort();
    console.log("\n  BRAUCHT SELBST:");
    if (eigene.length === 0) console.log("     (nichts Internes)");
    for (const d of eigene) console.log(`     → ${d}`);
    const p = pruefer(ziel);
    console.log("\n  ABGESICHERT DURCH PRÜFER:");
    console.log(p.length ? p.map((x) => `     ✓ ${x}`).join("\n") : "     (keiner — Änderung hier ist ungeprüft!)");
    console.log("\n" + "─".repeat(64));
    console.log("  Nach der Änderung: cd frontend && npm run check");
    console.log("─".repeat(64) + "\n");
    process.exit(0);
  }

  if (modus === "--audit") {
    // Selbstprüfung des Auflösers: Welche INTERNEN Import-Angaben konnten NICHT
    // auf eine Datei abgebildet werden? Jede davon wäre eine fehlende Kante und
    // damit eine Karte, die schweigt wo sie reden müsste. Benutzt bewusst
    // denselben Auflöser wie die Karte selbst — eine Nachbildung könnte
    // abweichen und würde nichts beweisen.
    const dateien = quelldateien();
    let intern = 0, extern = 0;
    const offen = [];
    for (const datei of dateien) {
      const src = fs.readFileSync(path.join(ROOT, datei), "utf8");
      const angaben = [];
      if (/\.(ts|tsx)$/.test(datei)) {
        for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s+["']([^"']+)["']/g)) angaben.push(m[1]);
        for (const m of src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) angaben.push(m[1]);
        for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) angaben.push(m[1]);
        for (const m of src.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) angaben.push(m[1]);
      } else {
        for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import/gm)) angaben.push(m[1]);
        for (const m of src.matchAll(/^\s*import\s+([\w.]+)/gm)) angaben.push(m[1]);
      }
      for (const a of angaben) {
        // Stylesheets, Bilder und Schriften sind keine Code-Abhängigkeiten und
        // gehören nicht in den Graphen — sie dürfen aber auch nicht als
        // "nicht auflösbar" gemeldet werden, sonst wäre die Selbstprüfung
        // dauerhaft rot und damit wertlos.
        if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|json)$/i.test(a)) { extern++; continue; }
        const istIntern = a.startsWith(".") || a.startsWith("@/")
          || ((datei.startsWith("backend/") || datei.startsWith("analysis-engine/")) && /^(services|core|api)[./]/.test(a));
        if (!istIntern) { extern++; continue; }
        if (aufloesen(datei, a)) intern++; else offen.push(`${datei}  →  ${a}`);
      }
    }
    console.log(`\n  Interne Angaben aufgelöst: ${intern}`);
    console.log(`  Externe Pakete (ignoriert): ${extern}`);
    console.log(`  NICHT aufgelöst:            ${offen.length}`);
    for (const o of offen.slice(0, 20)) console.log(`     ${o}`);
    if (offen.length > 20) console.log(`     … und ${offen.length - 20} weitere`);
    console.log("");
    process.exit(offen.length === 0 ? 0 : 1);
  }

  console.log("Aufruf:\n  node scripts/checks/system-map.js --impact <datei>\n  node scripts/checks/system-map.js --update\n  node scripts/checks/system-map.js --audit");
  process.exit(1);
}
