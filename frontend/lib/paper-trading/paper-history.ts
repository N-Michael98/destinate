import { dbGet, dbSet } from "../db-store";

type PaperHistoryEvent = {
  id: string;
  type: string;
  entity: "ORDER" | "POSITION" | "SYSTEM";
  event: string;
  timestamp: string;
  payload: unknown;
};

// Per-slot in-memory caches
declare global { var __paper_history__: Record<string, PaperHistoryEvent[] | undefined> | undefined; }
if (!global.__paper_history__) global.__paper_history__ = {};

function getCache(slot: string): PaperHistoryEvent[] {
  return global.__paper_history__![slot] ?? [];
}

function setCache(slot: string, history: PaperHistoryEvent[]) {
  global.__paper_history__![slot] = history;
}

// Load a slot from DB into cache on first access
async function ensureLoaded(slot: string): Promise<void> {
  if (global.__paper_history__![slot] === undefined) {
    const data = await dbGet<PaperHistoryEvent[]>(`paper-history-${slot}`, []);
    global.__paper_history__![slot] = data;
  }
}

// Persist cache to DB in background
function persist(slot: string) {
  dbSet(`paper-history-${slot}`, getCache(slot)).catch(() => {});
}

export class PaperHistory {
  // Synchronous read from cache (callers do NOT need await)
  static getAll(slot = "capital"): PaperHistoryEvent[] {
    // Trigger async load on first call; returns [] until loaded
    ensureLoaded(slot).catch(() => {});
    return getCache(slot);
  }

  static addOrderEvent(order: unknown, event: string, slot = "capital") {
    const history = getCache(slot);
    history.push({
      id: `ph-${Date.now()}`, type: event, entity: "ORDER",
      event, timestamp: new Date().toISOString(), payload: order,
    });
    setCache(slot, history);
    persist(slot);
  }

  static addPositionEvent(position: unknown, event: string, slot = "capital") {
    const history = getCache(slot);
    history.push({
      id: `ph-${Date.now()}`, type: event, entity: "POSITION",
      event, timestamp: new Date().toISOString(), payload: position,
    });
    setCache(slot, history);
    persist(slot);
  }

  static addSystemEvent(event: string, payload: unknown = {}, slot = "capital") {
    const history = getCache(slot);
    history.push({
      id: `ph-${Date.now()}`, type: event, entity: "SYSTEM",
      event, timestamp: new Date().toISOString(), payload,
    });
    setCache(slot, history);
    persist(slot);
  }

  static clear(slot = "capital") {
    setCache(slot, []);
    persist(slot);
  }

  // Load all slots from DB into cache (call from instrumentation)
  static async init(slots = ["capital", "icmarkets"]) {
    for (const slot of slots) {
      const data = await dbGet<PaperHistoryEvent[]>(`paper-history-${slot}`, []);
      global.__paper_history__![slot] = data;
    }
  }
}
