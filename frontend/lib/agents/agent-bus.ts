/**
 * Agent Bus — zentrales Kommunikationssystem zwischen allen Agents
 * Einfaches typed Pub/Sub System (in-memory, erweiterbar auf Redis/Queue)
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
  | "ANALYSIS:SIGNAL_GENERATED"
  | "DIAGNOSTICS:ALERT"
  | "DIAGNOSTICS:HEALTH_CHECK";

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

type EventHandler = (event: AgentEvent) => void | Promise<void>;

class AgentBus {
  private handlers: Map<AgentEventType, EventHandler[]> = new Map();
  private eventLog: AgentEvent[] = [];
  private readonly MAX_LOG = 500;

  publish(event: AgentEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > this.MAX_LOG) this.eventLog.shift();

    const handlers = this.handlers.get(event.type) ?? [];
    for (const h of handlers) {
      Promise.resolve(h(event)).catch(err =>
        console.error(`[agent-bus] Handler error for ${event.type}:`, err)
      );
    }

    console.log(`[agent-bus] 📡 ${event.agentId} → ${event.type}`);
  }

  subscribe(type: AgentEventType, handler: EventHandler): () => void {
    const existing = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...existing, handler]);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(type, current.filter(h => h !== handler));
    };
  }

  getRecentEvents(type?: AgentEventType, limit = 50): AgentEvent[] {
    const filtered = type ? this.eventLog.filter(e => e.type === type) : this.eventLog;
    return filtered.slice(-limit);
  }
}

// Singleton Bus — alle Agents teilen denselben Bus
export const agentBus = new AgentBus();
