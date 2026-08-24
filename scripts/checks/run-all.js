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
  // 03.08. ergänzt: die übrigen Prüfer sichern STRUKTUREN. Sie merken nicht,
  // wenn jemand einen WERT ändert — vorgeführt an MAX_SIZE BTCUSD 0.05 → 5.0,
  // dem hundertfachen Risiko, bei dem das ganze Netz grün blieb.
  ["snapshot", require("./snapshot")],
  // 05.08. ergaenzt: wer haengt an wem. Erzeugt aus den Importen, damit die
  // Karte nicht veralten kann — eine falsche Karte waere schlimmer als keine.
  ["system-map", require("./system-map")],
  // 10.08. ergaenzt: der erste Pruefer, der RECHNET statt nur zu schauen.
  // Alle zehn darueber sehen Struktur — ein Riegel, der vorhanden, aber subtil
  // falsch umgebaut wurde, faellt ihnen nicht auf (steht so auch in CLAUDE.md).
  // Bei den Ausstiegs-Schwellen waere genau das teuer: ein vertauschtes
  // Vorzeichen oder ein Faktor statt eines Divisors bliebe strukturell
  // unauffaellig und wirkte am offenen Geld.
  ["exit-schwellen", require("./exit-schwellen")],
  // 11.08. ergaenzt: ZWEI Systeme nahmen Teilgewinn auf derselben Position,
  // mit getrennten Merkern und ohne voneinander zu wissen — der Python-Teil
  // mit einer Groesse aus der Registrierung, die nach dem ersten Teilverkauf
  // die ganze Restposition geschlossen haette. Fuehrt die Entscheidung aus.
  ["teilgewinn", require("./teilgewinn")],
  // 13.08. ergaenzt: ZWEI Regler boten Werte an, die keinerlei Wirkung hatten —
  // die Signalkette verwirft alles unter 70 an drei Stellen. Ein Regler, der
  // etwas anzeigt, das er nicht kann, fuehrt zu falschen Entscheidungen.
  ["signal-untergrenze", require("./signal-untergrenze")],
  // 13.08. ergaenzt: eine Order galt als erfolgreich, obwohl der
  // Bestaetigungsschritt gar nicht gelesen werden konnte — ein unbekannter
  // Ausgang sah aus wie ein Erfolg. Dazu der Mindest-Stop-Abstand des Brokers,
  // der nie ausgewertet wurde.
  ["order-bestaetigung", require("./order-bestaetigung")],
  // 18.08. ergaenzt: der Python-Lifecycle haelt seine Trades nur im
  // Arbeitsspeicher und wurde NUR beim Eroeffnen gefuellt. Nach jedem Neustart
  // des Dienstes kannte er die offenen Positionen nicht mehr und antwortete
  // still mit action:null, waehrend das Log weiter "N Positionen fuer
  // Lifecycle-Update" meldete. Dazu: pyCloseTrade() hatte keinen Aufrufer,
  // _trades wurde nie geleert. Fuehrt die Entscheidung aus — blindes
  // Nachregistrieren waere schlimmer als keines.
  ["lifecycle-rueckkehr", require("./lifecycle-rueckkehr")],
  // 19.08. ergaenzt: das Python-Backend wurde im Hintergrund GAR NICHT
  // ueberwacht — pyHealthCheck() ohne Aufrufer, /api/market-data/health nur von
  // einem UI-Widget geholt, der Diagnostics-Agent prueft nur Agenten. Ein
  // Ausfall ueber Nacht fiel niemandem auf. Dazu der Riegel gegen
  // Dauermeldungen, der beim AI-Alarm vom 11.08. fehlte. Fuehrt die Zaehlung
  // aus: eine Ueberwachung, die falsch zaehlt, ist schlimmer als keine.
  ["python-ueberwachung", require("./python-ueberwachung")],
  // 23.08. ergaenzt: getVolatilityAdjustedRisk bestimmt die Positionsgroesse
  // nach ATR und war von KEINEM Pruefer erfasst. Vorgefuehrt: die Schwelle von
  // 3.0 auf 30.0 gezogen — die 0,4x-Klemme greift nie mehr — und alle sechzehn
  // blieben gruen. Seither haelt der Snapshot die Zahlen; dieser Pruefer
  // RECHNET zusaetzlich, denn ein Snapshot merkt keinen Umbau bei gleichen
  // Literalen. Der achte rechnende Pruefer.
  ["vola-skalierung", require("./vola-skalierung")],
  // 24.08. ergaenzt: die Kette prueft, ob der Kurs FRISCH ist — aber niemand
  // prueft, ob es ihn ueberhaupt gibt. checkLiquidity gab bei bid <= 0 sogar
  // ausdruecklich `allowed: true` zurueck. Ohne Preis ist die Positionsgroesse
  // geraten. Der neunte rechnende Pruefer; faengt auch NaN, das ein blosses
  // `bid <= 0` durchlaesst.
  ["kurs-riegel", require("./kurs-riegel")],
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
