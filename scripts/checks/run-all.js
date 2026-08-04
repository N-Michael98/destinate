#!/usr/bin/env node
// Sammelrunner für alle Regressionsprüfer.
//
// Aufruf:  node scripts/checks/run-all.js
// Oder:    npm run check   (im Ordner frontend/)
//
// Rückgabewert 0 = alles grün, 1 = mindestens ein Befund. Damit lässt sich der
// Runner unverändert in einen Git-Hook oder eine CI hängen.
//
// WAS DIESES NETZ LEISTET — und was nicht:
//   Es prüft STRUKTUR und KONSISTENZ des Quelltextes: sind alle Tabellen
//   vollständig, sind alle Listen deckungsgleich, sind die Riegel vorhanden und
//   an der richtigen Stelle, liegt kein Geheimnis im Code. Genau diese Klasse
//   von Fehlern hat uns wiederholt getroffen.
//   Es führt die Handelslogik NICHT aus und ersetzt keinen Live-Test. Ein
//   Riegel, der vorhanden, aber subtil falsch umgebaut wurde, fällt hier nicht
//   auf. Dafür braucht es weiterhin die Kontrolle am laufenden System.
const pruefer = [
  ["epic-tables",    require("./epic-tables")],
  ["watchlist-sync", require("./watchlist-sync")],
  ["backend-auth",   require("./backend-auth")],
  ["stop-guards",    require("./stop-guards")],
  ["ai-clamp",       require("./ai-clamp")],
  ["safety-nets",    require("./safety-nets")],
  ["secrets",        require("./secrets")],
  // 03.08. nachgezogen: beim ersten Bau des Netzes fehlten backend/ und
  // analysis-engine/ vollständig — zwei von drei Diensten waren ungeschützt.
  ["python-services", require("./python-services")],
];

const nurDieser = process.argv[2];
let befunde = 0;
let gelaufen = 0;

console.log("\n" + "─".repeat(64));
console.log("  REGRESSIONSPRÜFUNG");
console.log("─".repeat(64));

for (const [name, fn] of pruefer) {
  if (nurDieser && name !== nurDieser) continue;
  gelaufen++;
  let ergebnis;
  try {
    ergebnis = fn();
  } catch (e) {
    // Ein abgestürzter Prüfer ist selbst ein Befund — sonst hielte man ihn
    // fälschlich für bestanden.
    console.log(`  ✗ ${name.padEnd(16)} PRÜFER ABGESTÜRZT: ${e.message}`);
    befunde++;
    continue;
  }
  if (ergebnis.funde.length === 0) {
    console.log(`  ✓ ${name.padEnd(16)} ${ergebnis.titel}`);
  } else {
    console.log(`  ✗ ${name.padEnd(16)} ${ergebnis.titel}`);
    for (const f of ergebnis.funde) console.log(`      → ${f}`);
    befunde += ergebnis.funde.length;
  }
}

console.log("─".repeat(64));
if (gelaufen === 0) {
  console.log(`  Kein Prüfer namens "${nurDieser}" gefunden.`);
  process.exit(1);
}
if (befunde === 0) {
  console.log(`  ALLES GRÜN — ${gelaufen} Prüfer, 0 Befunde`);
} else {
  console.log(`  ${befunde} BEFUND(E) in ${gelaufen} Prüfern — NICHT committen, erst beheben`);
}
console.log("─".repeat(64) + "\n");
process.exit(befunde === 0 ? 0 : 1);
