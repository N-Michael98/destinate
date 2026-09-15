import { cacheListePush, cacheListeLesen, cacheListeEntfernen } from "@/lib/cache/redis-cache";

export type SecurityEventType =
  | "HONEYPOT_ACCESS"
  | "BRUTE_FORCE"
  | "SQL_INJECTION"
  | "XSS_ATTEMPT"
  | "SUSPICIOUS_UA"
  | "PATH_TRAVERSAL";

export interface SecurityEvent {
  type: SecurityEventType;
  ip: string;
  path: string;
  ua?: string;
  payload?: string;
  ts: number;
}

// ── SPEICHER UMGEBAUT (15.09.) ──────────────────────────────────────────────
//
// Bis heute lag die Liste als EIN JSON-Wert unter "security:events", und zwei
// Stellen verloren Ereignisse — bewiesen mit genau diesen Funktionen gegen einen
// nachgebildeten Redis:
//
//   1. logSecurityEvent las, fuegte vorne ein und schrieb zurueck. Gleichzeitige
//      Anfragen lasen denselben Stand: 20 Ereignisse von 20 IPs -> 1 gespeichert.
//      Ein koordinierter Angriff kommt genau so an — gleichzeitig.
//   2. clearSecurityEvents schrieb nach der Analyse `[]` und loeschte damit auch
//      alles, was WAEHREND des Claude-Aufrufs eingetroffen war, ungeprueft.
//
// Jetzt eine Redis-LISTE mit atomaren Befehlen (redis-cache.ts), und der
// Watchdog entfernt nur, was er wirklich gelesen hat. Neuer Schluessel, weil
// Redis eine Liste nicht unter einem Zeichenketten-Schluessel anlegen kann;
// der alte laeuft ueber seine TTL (1 h) von selbst ab.
const LISTE = "security:events:liste";
const MAX_EVENTS = 200;
const TTL_SECONDS = 60 * 60; // 1 hour

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    await cacheListePush(LISTE, event, MAX_EVENTS, TTL_SECONDS);
  } catch {
    // non-fatal — never block a request for logging
  }
}

/**
 * Ereignisse fuer eine Analyse lesen — mitsamt der Rohform, mit der sie nach
 * der Analyse GENAU so wieder entfernt werden.
 *
 * Unlesbare Eintraege stehen in `roh` (werden also mit entfernt), aber nicht
 * in `ereignisse` — sonst bliebe Muell ewig liegen.
 */
export async function leseSicherheitsereignisse(): Promise<{ ereignisse: SecurityEvent[]; roh: string[] }> {
  try {
    const roh = await cacheListeLesen(LISTE, MAX_EVENTS);
    const ereignisse: SecurityEvent[] = [];
    for (const r of roh) {
      try { ereignisse.push(JSON.parse(r) as SecurityEvent); } catch { /* unlesbar */ }
    }
    return { ereignisse, roh };
  } catch {
    return { ereignisse: [], roh: [] };
  }
}

/** Nur fuer lesende Anzeigen. Der Watchdog benutzt `leseSicherheitsereignisse`. */
export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  return (await leseSicherheitsereignisse()).ereignisse;
}

/**
 * Genau die analysierten Ereignisse entfernen. Was seit dem Lesen neu
 * eingetroffen ist, bleibt fuer den naechsten Zyklus stehen.
 *
 * ERSETZT `clearSecurityEvents()`, das alles loeschte. Ein "alles loeschen"
 * gibt es hier bewusst nicht mehr.
 */
export async function entferneAnalysierte(roh: string[]): Promise<void> {
  try {
    await cacheListeEntfernen(LISTE, roh);
  } catch { /* non-fatal — schlimmstenfalls werden sie ein zweites Mal gesehen */ }
}
