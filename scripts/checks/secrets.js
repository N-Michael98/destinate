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

  // Lokale Datenbank darf nicht eincheckbar sein.
  if (exists("frontend/prisma/dev.db")) {
    try {
      execSync("git check-ignore -q frontend/prisma/dev.db", { cwd: require("./_lib").ROOT });
    } catch {
      funde.push("frontend/prisma/dev.db liegt im Baum und ist NICHT in .gitignore");
    }
  }

  return { titel: `Geheimnisse (${dateien.length} Dateien)`, funde };
};
