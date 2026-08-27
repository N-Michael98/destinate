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
  // 24.08. ergaenzt: der Lernzyklus las ausschliesslich die PAPIERHANDELS-
  // Historie — gelernt wurde also aus Simulationen, waehrend die echten
  // geschlossenen Trades danebenlagen. Jetzt aus der Trade-Tabelle, und der
  // Bericht nennt die Quelle. Der zehnte rechnende Pruefer, und der erste
  // ASYNCHRONE: er ruft echteGeschlosseneTrades() wirklich auf.
  ["lern-quelle", require("./lern-quelle")],
  // 26.08. ergaenzt: `priceCache.set()` hatte im ganzen Programm KEINEN
  // Aufrufer — drei Ansichten lasen einen Cache, den nichts befuellte. Der
  // naheliegende Fix haette nicht gewirkt: der Zustand lag modul-scoped, und
  // genau daran ist am 28.07. schon der Killswitch gescheitert (API-Routen und
  // die Loops in instrumentation.ts sehen verschiedene Modul-Kopien). Der
  // elfte rechnende Pruefer laedt das Modul deshalb ZWEIMAL und prueft, dass
  // beide Instanzen denselben Zustand sehen — das kann keine Struktur-Pruefung.
  ["preis-cache", require("./preis-cache")],
  // 26.08. ergaenzt: das Dashboard ist EINE Seite mit einem Ansichtsumschalter.
  // Menue (navGroups) und Render-Kette (activeView === "…") stehen 3500 Zeilen
  // auseinander in derselben Datei — und waren auseinandergelaufen. "Live Prep"
  // stand im Menue ohne Render-Zeile; der Klick fiel auf den Platzhalter durch
  // und zeigte dort "Status: Prepared" in Gruen. Struktur-Pruefer, kein
  // rechnender: hier gibt es nichts zu rechnen, nur zwei Listen abzugleichen.
  ["menue-ansichten", require("./menue-ansichten")],
  // 26.08. ergaenzt, nach "seit gestern kein Trade": ein einziger
  // fehlgeschlagener Lesevorgang der Einstellungen beim Prozessstart klemmte
  // das System fuer die GESAMTE Laufzeit auf mode="MANUAL" — still, ohne
  // Alarm, ohne Erholung. Der zwoelfte rechnende Pruefer laesst eine
  // steuerbare Datenbank ausfallen und wiederkommen.
  ["einstellungen-ausfall", require("./einstellungen-ausfall")],
  // 27.08. ergaenzt: die technischen Werte gingen mit toFixed(2) in den
  // GPT-Prompt. Fuer die grossen FX-Paare (Kurs 0.6 bis 1.4) wurde der ATR
  // damit zu "0.00" — und genau davon haengt im Prompt die Stop-Platzierung
  // ab. Sechs von dreissig Maerkten waren betroffen, still, seit jeher.
  // Der dreizehnte rechnende Pruefer ruft die Formatierung mit echten
  // Groessenordnungen auf.
  ["prompt-zahlen", require("./prompt-zahlen")],
];

const nurDieser = process.argv[2];
let befunde = 0;
let gelaufen = 0;

console.log("\n" + "─".repeat(64));
console.log("  REGRESSIONSPRÜFUNG");
console.log("─".repeat(64));

// ASYNCHRON SEIT 24.08. Ein Prüfer, der eine echte async-Funktion aufruft
// (lern-quelle ruft echteGeschlosseneTrades, das die Datenbank liest), gibt
// ein Promise zurück. Vorher lief `ergebnis.funde.length` darauf ins Leere und
// der Prüfer wurde als ABGESTÜRZT gemeldet — ein Prüfer, den man technisch
// nicht schreiben kann, ist eine stille Grenze des Netzes.
//
// Rückwärtskompatibel: `await` auf einen gewöhnlichen Rückgabewert liefert
// genau diesen Wert. Alle bestehenden Prüfer bleiben unverändert.
async function alleLaufen() {
  for (const [name, fn] of pruefer) {
    if (nurDieser && name !== nurDieser) continue;
    gelaufen++;
    let ergebnis;
    try {
      ergebnis = await fn();
    } catch (e) {
      // Ein abgestürzter Prüfer ist selbst ein Befund — sonst hielte man ihn
      // fälschlich für bestanden.
      console.log(`  ✗ ${name.padEnd(16)} PRÜFER ABGESTÜRZT: ${e.message}`);
      befunde++;
      continue;
    }
    // Ein Prüfer, der etwas anderes als { titel, funde } liefert, ist kaputt —
    // ohne diese Zeile stürzte die Auswertung hier ab statt es zu melden.
    if (!ergebnis || !Array.isArray(ergebnis.funde)) {
      console.log(`  ✗ ${name.padEnd(16)} PRÜFER liefert kein { titel, funde }`);
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
  auswerten();
}

function auswerten() {
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
}

alleLaufen().catch((e) => {
  // Auch der Läufer selbst darf nicht still sterben.
  console.log(`\n  ✗ REGRESSIONSPRÜFUNG ABGEBROCHEN: ${e && e.message}\n`);
  process.exit(1);
});
