/**
 * Agent Bus — zentrales Kommunikationssystem zwischen allen Agents
 * Einfaches typed Pub/Sub System (in-memory, erweiterbar auf Redis/Queue)
 *
 * ── UMBAU 16.09. ────────────────────────────────────────────────────────────
 *
 * GEMESSEN vor dem Umbau: 13 Sendestellen, im ganzen Programm EIN Empfaenger
 * (DiagnosticsAgent), und der hoerte `ANALYSIS:SIGNAL_GENERATED` nicht einmal
 * ab. Die Agenten redeten also nicht ueber den Bus miteinander — die Kette
 * Orchestrator -> Analyse -> Ausfuehrung laeuft ueber direkte Aufrufe, und die
 * Entscheidungen der drei KI-Tore (Meta-KI, Orchestrator-KI, Ausfuehrungs-KI)
 * kamen nirgends zusammen. Wie viele Signale an welchem Tor sterben, konnte
 * deshalb niemand ueber mehrere Zyklen sagen.
 *
 * Drei Fehler dieser Datei selbst:
 *
 *   1. MODUL-SCOPED. `export const agentBus = new AgentBus()` — genau das
 *      Muster, das am 28.07. den Killswitch und am 26.08. den Preis-Cache
 *      ausgehebelt hat. API-Routen und die Schleifen aus instrumentation.ts
 *      sehen verschiedene Modulkopien; jede haette ihren eigenen Bus. Jetzt
 *      liegt der Bus auf `global.__agent_bus__`.
 *
 *   2. EIN SYNCHRON WERFENDER EMPFAENGER RISS DEN SENDER MIT.
 *      `Promise.resolve(h(event)).catch(...)` wertet `h(event)` ZUERST aus —
 *      wirft der Empfaenger synchron, verlaesst die Ausnahme `publish()` und
 *      landet beim Sender (Orchestrator, RiskAgent, ExecutionAgent). Ein
 *      Beobachter darf den Beobachteten nie stoppen.
 *
 *   3. Eine von der KI ABGELEHNTE Order wurde als `EXECUTION:TRADE_CLOSED`
 *      gesendet, obwohl nie ein Trade offen war. Tor-Entscheidungen haben
 *      jetzt einen eigenen Typ: `GATE:DECISION`.
 */

export type AgentEventType =
  | "RISK:HEARTBEAT"
  | "RISK:BE_SET"
  | "RISK:TRAIL_UPDATED"
  | "RISK:PARTIAL_TP"
  | "RISK:POSITION_CLOSED"
  | "RISK:ERROR"
  | "EXECUTION:TRADE_OPENED"
  | "EXECUTION:TRADE_CLOSED"
  | "EXECUTION:TRADE_FAILED"
  | "ANALYSIS:SIGNAL_GENERATED"
  | "ANALYSIS:SCAN_DONE"
  | "GATE:DECISION"
  | "CYCLE:STARTED"
  | "CYCLE:FINISHED"
  | "DIAGNOSTICS:ALERT"
  | "DIAGNOSTICS:HEALTH_CHECK";

/** Die Tore, die ueber einen Kandidaten entscheiden — in Reihenfolge der Kette. */
export type GateName =
  | "Meta-KI"
  | "Orchestrator-KI"
  | "Walk-Forward"
  | "Schwelle"
  | "Stil-Limit"
  | "Duplikat"
  | "Filterkette"
  | "Override"
  /** Die Kandidaten danach wurden GAR NICHT mehr geprueft (18.09.) — der
   *  Zyklus war nach einem Trade oder am Limit der Orchestrator-KI zu Ende. */
  | "Zyklus-Limit"
  | "Ausfuehrungs-KI"
  | "Broker";

/** Payload von `GATE:DECISION`. `fallback` = das Tor hat NICHT geurteilt
 *  (KI-Ausfall o. ae.) und der Rueckfall galt — das ist keine Zustimmung. */
export interface GateDecisionPayload {
  gate: GateName;
  symbol?: string;
  direction?: string;
  approve: boolean;
  reason: string;
  fallback?: boolean;
  confidence?: number;
}

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

type EventHandler = (event: AgentEvent) => void | Promise<void>;

export class AgentBus {
  private handlers: Map<AgentEventType, EventHandler[]> = new Map();
  private eventLog: AgentEvent[] = [];
  private readonly MAX_LOG = 500;
  /** Diese Typen kommen im Minutentakt — ihr Log waere nur Rauschen. */
  private static readonly LEISE: ReadonlySet<AgentEventType> = new Set<AgentEventType>([
    "RISK:HEARTBEAT", "GATE:DECISION", "ANALYSIS:SIGNAL_GENERATED",
  ]);

  publish(event: AgentEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > this.MAX_LOG) this.eventLog.shift();

    const handlers = this.handlers.get(event.type) ?? [];
    for (const h of handlers) {
      // `try` UM den Aufruf, nicht nur `.catch` DAHINTER — siehe Punkt 2 oben.
      try {
        Promise.resolve(h(event)).catch(err =>
          console.error(`[agent-bus] Handler error for ${event.type}:`, err)
        );
      } catch (err) {
        console.error(`[agent-bus] Handler error for ${event.type}:`, err);
      }
    }

    if (!AgentBus.LEISE.has(event.type)) {
      console.log(`[agent-bus] 📡 ${event.agentId} → ${event.type}`);
    }
  }

  subscribe(type: AgentEventType, handler: EventHandler): () => void {
    const existing = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...existing, handler]);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(type, current.filter(h => h !== handler));
    };
  }

  /** Wie viele Empfaenger ein Typ hat — fuer die Verdrahtungspruefung. */
  subscriberCount(type: AgentEventType): number {
    return (this.handlers.get(type) ?? []).length;
  }

  getRecentEvents(type?: AgentEventType, limit = 50): AgentEvent[] {
    const filtered = type ? this.eventLog.filter(e => e.type === type) : this.eventLog;
    return filtered.slice(-limit);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __agent_bus__: AgentBus | undefined;
}

// EIN Bus fuer den ganzen Prozess — auf `global`, nicht modul-scoped (Punkt 1).
// Die erste Modulkopie legt ihn an, jede weitere benutzt denselben.
export const agentBus: AgentBus = (global.__agent_bus__ ??= new AgentBus());

/** Eine Tor-Entscheidung senden. Wirft nie. */
export function meldeTorEntscheidung(agentId: string, d: GateDecisionPayload): void {
  try {
    agentBus.publish({
      type: "GATE:DECISION",
      agentId,
      timestamp: new Date().toISOString(),
      payload: d as unknown as Record<string, unknown>,
    });
  } catch { /* der Bus darf nie der Grund sein, warum etwas scheitert */ }
}
