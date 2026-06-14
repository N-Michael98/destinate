import { dbGet, dbSet } from "../db-store";

export type MissionControlEventSeverity = "INFO" | "WARNING" | "CRITICAL";

export type MissionControlEventLogEntry = {
  id: string;
  type: string;
  severity: MissionControlEventSeverity;
  source: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

export type MissionControlEventLogStats = {
  totalEvents: number;
  infoEvents: number;
  warningEvents: number;
  criticalEvents: number;
  latestEvent: MissionControlEventLogEntry | null;
  updatedAt: string;
};

const DB_KEY = "mission-control-event-log";
const MAX_EVENTS = 250;

declare global { var __mc_event_log__: MissionControlEventLogEntry[] | undefined; }

function getCache(): MissionControlEventLogEntry[] {
  return global.__mc_event_log__ ?? [];
}

export class MissionControlEventLog {
  static getAll(): MissionControlEventLogEntry[] { return getCache(); }
  static getLatest(limit = 25) { return getCache().slice(0, limit); }
  static getBySeverity(severity: MissionControlEventSeverity, limit = 25) {
    return getCache().filter((e) => e.severity === severity).slice(0, limit);
  }
  static getStats(): MissionControlEventLogStats {
    const events = getCache();
    return {
      totalEvents: events.length,
      infoEvents: events.filter((e) => e.severity === "INFO").length,
      warningEvents: events.filter((e) => e.severity === "WARNING").length,
      criticalEvents: events.filter((e) => e.severity === "CRITICAL").length,
      latestEvent: events[0] ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
  static addDeduped(
    entry: { type: string; severity: MissionControlEventSeverity; source: string; message: string; payload?: unknown },
    dedupeWindowMs = 5 * 60 * 1000
  ): MissionControlEventLogEntry {
    const events = getCache();
    const now = Date.now();
    const dup = events.find((e) =>
      e.type === entry.type && e.source === entry.source && e.severity === entry.severity &&
      now - new Date(e.createdAt).getTime() <= dedupeWindowMs
    );
    if (dup) return dup;
    return MissionControlEventLog.add(entry);
  }
  static add(entry: { type: string; severity: MissionControlEventSeverity; source: string; message: string; payload?: unknown }): MissionControlEventLogEntry {
    const events = getCache();
    const newEvent: MissionControlEventLogEntry = {
      id: `mc-event-${entry.source.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      type: entry.type, severity: entry.severity, source: entry.source,
      message: entry.message, payload: entry.payload ?? {}, createdAt: new Date().toISOString(),
    };
    const next = [newEvent, ...events].slice(0, MAX_EVENTS);
    global.__mc_event_log__ = next;
    dbSet(DB_KEY, next).catch(() => {});
    return newEvent;
  }
  static clear(): void {
    global.__mc_event_log__ = [];
    dbSet(DB_KEY, []).catch(() => {});
  }
  static async init(): Promise<void> {
    global.__mc_event_log__ = await dbGet<MissionControlEventLogEntry[]>(DB_KEY, []);
  }
}
