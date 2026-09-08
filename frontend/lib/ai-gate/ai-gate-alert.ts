/**
 * Meldung, wenn ein KI-Sicherheitstor ausfällt — EINE Stelle für alle (08.09.).
 *
 * ANLASS. Am 08.09. war das Anthropic-Guthaben leer. Über Telegram kam
 * stündlich genau eine Meldung — die des Orchestrators. Nachgezählt fielen aber
 * VIER Tore aus, und gemeldet wurden ZWEI:
 *
 *   Tor                          Verhalten bei Ausfall        Alarm
 *   Orchestrator AI Manager      proceed: true                ja
 *   ExecutionAgent AI Manager    approve: true, beide Broker   ja
 *   Meta-KI (analysis-agent)     ALLE Kandidaten approved      NEIN
 *   Risk-Agent AI (Ausstiege)    action: "APPROVE"             NEIN
 *   Security-Watchdog            return null, keine Eskalation NEIN
 *
 * Der Text der Meldung sagte dazu „andere Sicherheitsschichten bleiben aktiv".
 * Für die NICHT-KI-Schichten stimmt das; für die anderen KI-Tore stimmte es
 * nicht. Wer die Meldung las, konnte annehmen, nur ein Tor sei betroffen.
 *
 * ZWEITER ANLASS: `alertAIGateFallback` stand ZWEIMAL im Code, wortgleich in
 * `orchestrator-agent.ts` und `execution-agent.ts`. Dieselbe Entscheidung an
 * zwei Stellen ist die Fehlerklasse, an der dieses Programm wiederholt
 * gelitten hat — eine Änderung am Text hätte nur die eine Hälfte getroffen.
 */

// Der Drosselungs-Zustand gehört auf `global` (CLAUDE.md): diese Datei wird
// sowohl von API-Routen als auch von den Schleifen in `instrumentation.ts`
// erreicht. Modul-scoped sähe jede Seite ihren eigenen Zähler und die Drossel
// wäre je Seite eine eigene — belegt am Killswitch (28.07.) und am
// Preis-Cache (26.08.).
declare global {
  var __ai_gate_alert__: Record<string, number> | undefined;
}

const EINE_STUNDE_MS = 60 * 60 * 1000;

/** Je Tor getrennt gedrosselt.
 *
 * BEWUSST NICHT EIN gemeinsamer Zeitstempel: fielen zwei Tore kurz nacheinander
 * aus, hätte der erste Alarm den zweiten für eine Stunde verschluckt — und
 * genau die Vollständigkeit ist der Zweck dieser Datei.
 */
export function alarmFaellig(gate: string, jetzt = Date.now()): boolean {
  if (!global.__ai_gate_alert__) global.__ai_gate_alert__ = {};
  const zuletzt = global.__ai_gate_alert__[gate] ?? 0;
  if (jetzt - zuletzt < EINE_STUNDE_MS) return false;
  global.__ai_gate_alert__[gate] = jetzt;
  return true;
}

/** Was das ausgefallene Tor konkret NICHT mehr prüft. */
export const TOR_FOLGE: Record<string, string> = {
  Orchestrator:   "Der Zyklus läuft ohne KI-Freigabe weiter (proceed).",
  ExecutionAgent: "Aufträge gehen ohne KI-Freigabe an beide Broker.",
  "Meta-KI":      "ALLE Kandidaten gelten als freigegeben — die Gegenprüfung "
                + "auf RSI-Extreme und TA-Widerspruch entfällt.",
  "Risk-Agent":   "Ausstiege laufen rein regelbasiert weiter (Breakeven, "
                + "Teilgewinn, Trailing, Zeit-Exit) — die KI berät nicht mehr.",
  Watchdog:       "Sicherheitsereignisse werden NICHT mehr beurteilt. Der "
                + "automatische Killswitch bei einem Angriff kann nicht auslösen.",
};

/** Die Schichten, die NACHWEISLICH weiterlaufen — keine davon braucht KI.
 *
 * Jede Zeile ist im Code belegt; pauschales „andere Schichten bleiben aktiv"
 * war zu viel behauptet.
 */
const BLEIBT_AKTIV = [
  "Killswitch (seit 07.09. direkt in beiden Ausführungsfunktionen)",
  "Handelszeitfenster Mo–Fr 08:00–22:00 UTC",
  "Filterkette, neun Stufen (u. a. Kurs vorhanden, Spread, Duplikat-Schutz)",
  "Freigabe-Schwelle inkl. Untergrenze 70",
  "Positions- und Tageslimit",
  "Broker-seitige Stops und Ziele",
  "Regelbasierte Risikoprüfung statt Claude (STRENGER: verlangt zusätzlich Confidence ≥ 70)",
];

/**
 * Meldet den Ausfall eines KI-Tors — höchstens einmal pro Stunde und Tor.
 *
 * Wirft nie: eine fehlgeschlagene Meldung darf den Handelszyklus nicht
 * mitreissen (Fehlerklasse vom 19.08.).
 */
export async function meldeAIGateAusfall(gate: string, err: unknown): Promise<void> {
  if (!alarmFaellig(gate)) return;
  const folge = TOR_FOLGE[gate] ?? "Dieses Tor prüft nicht mehr.";
  const grund = err instanceof Error ? err.message : String(err);
  try {
    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    await sendTelegram(
      `⚠️ KI-Sicherheitstor "${gate}" nicht erreichbar — Rückfall aktiv.\n\n`
      + `WAS DAS TOR NICHT MEHR TUT:\n${folge}\n\n`
      + `WEITERHIN AKTIV (ohne KI):\n`
      + BLEIBT_AKTIV.map((z) => `• ${z}`).join("\n")
      + `\n\nAndere KI-Tore können GLEICHZEITIG betroffen sein — jedes meldet `
      + `sich einzeln, höchstens 1×/Stunde.\n\nFehler: ${grund}`
    );
  } catch { /* non-fatal */ }
}
