/**
 * Zustand des Exit-AI-Managers (11.08.).
 *
 * WOZU. Faellt die AI aus, faengt askAIManager() das ab und liefert APPROVE —
 * das System laeuft regelbasiert weiter. Das ist als Verhalten richtig, aber
 * es war UNSICHTBAR: es entstand eine console.warn-Zeile und sonst nichts.
 * Ein stummer Ausfall ueber Tage faellt nur auf, wenn jemand Logs liest. Man
 * konnte also nicht beantworten, ob die AI ueberhaupt noch mitredet oder ob
 * das System seit Tagen rein regelbasiert handelt.
 *
 * Reine Zaehlung, kein Netz, keine Datenbank: dieses Modul darf niemals ein
 * Grund sein, warum ein Handelszyklus scheitert.
 *
 * ZUR LEBENSDAUER, offen gesagt: die Zaehler liegen im Arbeitsspeicher des
 * Prozesses und sind nach einem Neustart weg. Das genuegt fuer die Frage
 * "redet die AI gerade mit?" — genau dafuer ist es gebaut. Wer die Wirkung
 * einzelner Entscheidungen ueber Wochen auswerten will, findet sie in
 * Trade.notes (aiEntscheidungen), wo sie einen Neustart ueberleben.
 */

export type AIMassnahme = "BREAKEVEN" | "TRAIL" | "PARTIAL_TP";
export type AIAusgang = "APPROVE" | "SKIP" | "ADJUST" | "FALLBACK";

const AUSGAENGE: AIAusgang[] = ["APPROVE", "SKIP", "ADJUST", "FALLBACK"];
const MASSNAHMEN: AIMassnahme[] = ["BREAKEVEN", "TRAIL", "PARTIAL_TP"];

/** Ab wie vielen Fehlschlaegen in Folge die AI als ausgefallen gilt.
 *  Eins waere zu nervoes (ein einzelner Zeitfehler kommt vor), fuenf zu
 *  traege — bei einem Zyklus alle 2 Minuten waeren das ueber 10 Minuten
 *  blinder Betrieb, bevor es jemand merkt. */
export const AUSFALL_AB_FEHLERN = 3;

export interface AIManagerStatus {
  seit: string;
  gesamt: number;
  nachAusgang: Record<AIAusgang, number>;
  nachMassnahme: Record<AIMassnahme, Record<AIAusgang, number>>;
  letzterErfolgAt: string | null;
  letzterFehlerAt: string | null;
  letzterFehler: string | null;
  fehlerInFolge: number;
  fallbackAnteilPct: number;
  /** true = antwortet, false = faellt aus, null = seit dem Start noch nicht gefragt.
   *  null ist NICHT dasselbe wie "laeuft" — ohne offene Position wird der
   *  Manager gar nicht gerufen, und das darf nicht als Ausfall gelten. */
  erreichbar: boolean | null;
}

function leererZaehler(): Record<AIAusgang, number> {
  return { APPROVE: 0, SKIP: 0, ADJUST: 0, FALLBACK: 0 };
}

interface Zustand {
  seit: string;
  nachAusgang: Record<AIAusgang, number>;
  nachMassnahme: Record<AIMassnahme, Record<AIAusgang, number>>;
  letzterErfolgAt: string | null;
  letzterFehlerAt: string | null;
  letzterFehler: string | null;
  fehlerInFolge: number;
  /** Wurde der laufende Ausfall schon gemeldet? (19.08.) */
  ausfallGemeldet: boolean;
}

function neuerZustand(): Zustand {
  return {
    seit: new Date().toISOString(),
    nachAusgang: leererZaehler(),
    nachMassnahme: {
      BREAKEVEN: leererZaehler(), TRAIL: leererZaehler(), PARTIAL_TP: leererZaehler(),
    },
    letzterErfolgAt: null,
    letzterFehlerAt: null,
    letzterFehler: null,
    fehlerInFolge: 0,
    ausfallGemeldet: false,
  };
}

// Prozessweit, damit ein Modul-Neuimport in Next.js die Zaehlung nicht
// zuruecksetzt — dasselbe Muster wie beim Einstellungs-Zwischenspeicher.
declare global { var __ai_manager_status__: Zustand | undefined; }

function zustand(): Zustand {
  if (!global.__ai_manager_status__) global.__ai_manager_status__ = neuerZustand();
  return global.__ai_manager_status__;
}

/**
 * Eine Entscheidung des AI Managers verbuchen.
 *
 * @param massnahme  welche der drei Massnahmen anstand
 * @param ausgang    APPROVE/SKIP/ADJUST = die AI hat geantwortet,
 *                   FALLBACK = sie war nicht erreichbar
 * @param fehler     Fehlertext, nur bei FALLBACK
 */
export function meldeAIEntscheidung(
  massnahme: AIMassnahme,
  ausgang: AIAusgang,
  fehler?: string,
): void {
  // Niemals werfen: dieses Modul zaehlt nur mit und darf einen Handelszyklus
  // unter keinen Umstaenden abbrechen.
  try {
    const z = zustand();
    if (!AUSGAENGE.includes(ausgang)) return;
    const m: AIMassnahme = MASSNAHMEN.includes(massnahme) ? massnahme : "BREAKEVEN";
    z.nachAusgang[ausgang]++;
    z.nachMassnahme[m][ausgang]++;
    const jetzt = new Date().toISOString();
    if (ausgang === "FALLBACK") {
      z.fehlerInFolge++;
      z.letzterFehlerAt = jetzt;
      z.letzterFehler = (fehler ?? "unbekannt").slice(0, 200);
    } else {
      z.fehlerInFolge = 0;
      z.letzterErfolgAt = jetzt;
    }
  } catch { /* Zaehlen darf nie stoeren */ }
}

export function getAIManagerStatus(): AIManagerStatus {
  const z = zustand();
  const gesamt = AUSGAENGE.reduce((s, a) => s + z.nachAusgang[a], 0);
  return {
    seit: z.seit,
    gesamt,
    nachAusgang: { ...z.nachAusgang },
    nachMassnahme: {
      BREAKEVEN: { ...z.nachMassnahme.BREAKEVEN },
      TRAIL: { ...z.nachMassnahme.TRAIL },
      PARTIAL_TP: { ...z.nachMassnahme.PARTIAL_TP },
    },
    letzterErfolgAt: z.letzterErfolgAt,
    letzterFehlerAt: z.letzterFehlerAt,
    letzterFehler: z.letzterFehler,
    fehlerInFolge: z.fehlerInFolge,
    fallbackAnteilPct: gesamt > 0
      ? Math.round((z.nachAusgang.FALLBACK / gesamt) * 1000) / 10
      : 0,
    // Noch nie gefragt -> null. Ohne offene Position wird der Manager gar nicht
    // gerufen; das als Ausfall zu melden waere ein Fehlalarm.
    erreichbar: gesamt === 0 ? null : z.fehlerInFolge < AUSFALL_AB_FEHLERN,
  };
}

export type AIUebergang = "AUSFALL" | "ERHOLT" | null;

/**
 * Gibt den Zustandswechsel zurueck — und zwar GENAU EINMAL je Wechsel (19.08.).
 *
 * BEHOBENER FEHLER. Der Diagnostics-Agent fragte bis zum 19.08. nur
 * `erreichbar === false` ab und rief dann direkt sendDiagnosticsAlert(). Da er
 * alle fuenf Minuten laeuft, kam waehrend eines Ausfalls alle fuenf Minuten
 * dieselbe Telegram-Nachricht — bei einer Nacht Ausfall zwoelf pro Stunde,
 * ohne Ende. Der Vergleich zeigt es: AGENT_DEAD ist ueber `hb.status !==
 * "DEAD"` gegen Wiederholung gesichert, recordAnomaly meldet nur beim
 * Erreichen der Schwelle (`count === ANOMALY_ALERT_THRESHOLD`) — nur dieser
 * eine Alarm hatte keinen solchen Riegel.
 *
 * "ERHOLT" wird ebenfalls genau einmal gemeldet: die Entwarnung ist die
 * wichtigere Haelfte, sonst weiss niemand, ob der Ausfall noch anhaelt.
 */
export function aiManagerUebergang(): AIUebergang {
  try {
    const z = zustand();
    // Kein gesonderter Riegel fuer "nie gefragt" — er waere tot: ohne Anfrage
    // ist fehlerInFolge 0 und ausfallGemeldet false. Nachgewiesen im
    // Sabotage-Lauf am 19.08. (siehe python-status.ts, gleiche Stelle).
    const ausgefallen = z.fehlerInFolge >= AUSFALL_AB_FEHLERN;
    if (ausgefallen && !z.ausfallGemeldet) {
      z.ausfallGemeldet = true;
      return "AUSFALL";
    }
    if (!ausgefallen && z.ausfallGemeldet) {
      z.ausfallGemeldet = false;
      return "ERHOLT";
    }
    return null;
  } catch {
    return null;
  }
}

/** Nur für Tests und Prüfer. */
export function resetAIManagerStatus(): void {
  global.__ai_manager_status__ = neuerZustand();
}
