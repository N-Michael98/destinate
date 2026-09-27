// PRÜFT: Keine Geheimnisse im Quelltext, keine .env im Repository,
// kein Schlüssel in einer Log-Ausgabe.
//
// WARUM: Am 03.08. verbrannten zwei API-Schlüssel, weil PowerShell sie in einer
// Fehlermeldung wiederholte. Im Code selbst darf so etwas gar nicht erst
// entstehen. Ausserdem lag eine lokale Datenbank ungeschützt im Arbeitsbaum.
const { read, sourceFiles, exists } = require("./_lib");
const { execSync } = require("child_process");

const GEHEIM = /(api[_-]?key|password|passwort|secret|token)\s*[:=]\s*["'][A-Za-z0-9_/+=-]{20,}["']/i;
const HARMLOS = /example|beispiel|platzhalter|placeholder|dein_|your_|xxx|\.\.\./i;

module.exports = function pruefe() {
  const funde = [];
  const dateien = sourceFiles([".ts", ".tsx", ".py"]);

  for (const datei of dateien) {
    const zeilen = read(datei).split("\n");
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (!GEHEIM.test(z) || HARMLOS.test(z)) continue;
      if (/process\.env|os\.getenv|settings\.|getenv\(/.test(z)) continue;
      funde.push(`${datei}:${i + 1} sieht nach hartcodiertem Geheimnis aus`);
    }
  }

  // Schlüssel in einer Ausgabe? Der Wert selbst darf nie in ein Log.
  for (const datei of dateien.filter((f) => f.endsWith(".ts"))) {
    const zeilen = read(datei).split("\n");
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (!/console\.(log|warn|error)/.test(z)) continue;
      // Erlaubt sind Formen, die nur das VORHANDENSEIN prüfen: !!key, key.length,
      // sowie die Fingerabdruck-Funktion.
      if (/\$\{[^}]*\b(apiKey|API_KEY|password|securityToken|cst)\b[^}]*\}/.test(z)
          && !/!!|\.length|vorhanden|Fingerabdruck|entferneGeheimnisse/.test(z)) {
        funde.push(`${datei}:${i + 1} gibt möglicherweise einen Schlüssel aus`);
      }
    }
  }

  // .env im Repository?
  try {
    const verfolgt = execSync("git ls-files", { cwd: require("./_lib").ROOT, encoding: "utf8" })
      .split("\n").filter((f) => /(^|\/)\.env($|\.)/.test(f) && !/example/.test(f));
    for (const f of verfolgt) funde.push(`${f} ist im Repository eingecheckt`);
  } catch { funde.push("git ls-files nicht ausführbar — .env-Prüfung übersprungen"); }

  // ── DIE ERSTE SCHICHT: .gitignore MUSS jede .env fangen (27.09.) ─────────
  //
  // Die Pruefung darueber ist die ZWEITE Schicht: sie schlaegt an, wenn eine
  // .env bereits eingecheckt IST. Dann ist das Geheimnis aber schon in der
  // Historie — ein `git rm` holt es dort nicht mehr heraus.
  //
  // GEMESSEN am 27.09. mit `git check-ignore`: geschuetzt waren nur
  // frontend/.env und analysis-engine/.env. `.env` und `.env.local` im
  // Wurzelverzeichnis und `backend/.env` waren OFFEN — dort haette ein
  // `git add .` sie aufgenommen. Durchgerutscht ist nie etwas (ganze Historie
  // geprueft), aber die erste Schicht fehlte.
  //
  // DYNAMISCH statt feste Liste: geprueft wird das Wurzelverzeichnis UND jedes
  // oberste Verzeichnis, das Git kennt. Kommt ein vierter Dienst dazu, ist er
  // damit automatisch erfasst — eine feste Liste waere genau der Grund, warum
  // die Luecke ueberhaupt entstanden ist (frontend/ und analysis-engine/
  // hatten eine eigene .gitignore, backend/ nicht).
  try {
    const alle = execSync("git ls-files", { cwd: require("./_lib").ROOT, encoding: "utf8" })
      .split("\n").map((f) => f.trim()).filter(Boolean);
    const ordner = new Set([""]);
    for (const f of alle) {
      const i = f.indexOf("/");
      if (i > 0) ordner.add(`${f.slice(0, i)}/`);
    }
    const geheim = [];      // muessen ignoriert sein
    const vorlagen = [];    // muessen SICHTBAR bleiben
    for (const d of ordner) {
      for (const n of [".env", ".env.local", ".env.production"]) geheim.push(`${d}${n}`);
      for (const n of [".env.example", ".env.local.example"]) vorlagen.push(`${d}${n}`);
    }

    // `git check-ignore --stdin` gibt NUR die ignorierten Pfade aus und endet
    // mit Code 1, wenn keiner passt — das ist kein Fehler, aber execSync wirft
    // dabei. Deshalb wird stdout auch aus dem Fehlerobjekt gelesen.
    const ignorierte = (eingabe) => {
      try {
        const aus = execSync("git check-ignore --stdin", {
          cwd: require("./_lib").ROOT, encoding: "utf8", input: eingabe.join("\n"),
        });
        return new Set(aus.split("\n").map((s) => s.trim()).filter(Boolean));
      } catch (e) {
        if (e.status === 1) {
          return new Set(String(e.stdout ?? "").split("\n").map((s) => s.trim()).filter(Boolean));
        }
        throw e;   // 128 o.ae. ist ein echter Fehler und darf nicht als "alles gut" gelten
      }
    };

    const istIgnoriert = ignorierte(geheim);
    const offen = geheim.filter((p) => !istIgnoriert.has(p));
    for (const p of offen) {
      funde.push(`${p} ist NICHT von .gitignore gedeckt — ein \`git add .\` wuerde die Zugangsdaten aufnehmen`);
    }

    // Die Gegenprobe. Ohne sie waere ein `.env*` ohne Ausnahme "gruen" — und
    // wuerde jede Vorlage still verschlucken. Genau das tat frontend/.gitignore
    // (Zeile aus der Next.js-Vorlage), belegt mit `git check-ignore -v`.
    const vorlageIgnoriert = ignorierte(vorlagen);
    for (const p of vorlagen.filter((v) => vorlageIgnoriert.has(v))) {
      funde.push(`${p} wird von .gitignore verschluckt — eine Vorlage enthaelt nur Schluesselnamen und gehoert ins Repository`);
    }
  } catch (e) {
    funde.push(`.gitignore-Deckung nicht pruefbar: ${e.message}`);
  }

  // Datenbanken und Archive duerfen nicht im Repository liegen.
  // ERWEITERT 05.08.: geprueft wurde nur frontend/prisma/dev.db. Dabei lag
  // frontend/dev.db seit Commit 288e235 EINGECHECKT im Repo — eine zweite
  // Datenbank an anderer Stelle, die genau deshalb durchgerutscht ist. Jetzt
  // wird nach Endung gesucht statt nach einem festen Pfad.
  try {
    const verfolgt = execSync("git ls-files", { cwd: require("./_lib").ROOT, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(db|sqlite|sqlite3|bak|dump|pem|p12|pfx)$/i.test(f.trim()));
    for (const f of verfolgt) funde.push(`${f} ist im Repository eingecheckt (Datenbank/Zertifikat gehoert nicht dorthin)`);
  } catch { funde.push("git ls-files nicht ausfuehrbar — Datenbank-Pruefung uebersprungen"); }

  return { titel: `Geheimnisse (${dateien.length} Dateien)`, funde };
};
