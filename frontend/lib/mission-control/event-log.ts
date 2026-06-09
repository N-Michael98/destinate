import fs from "fs";
import path from "path";

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

const eventLogFilePath = path.join(
  process.cwd(),
  "lib",
  "data",
  "mission-control-event-log.json"
);

function ensureEventLogFile() {
  const directory = path.dirname(eventLogFilePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(eventLogFilePath)) {
    fs.writeFileSync(eventLogFilePath, "[]", "utf-8");
  }
}

function readEventLog(): MissionControlEventLogEntry[] {
  ensureEventLogFile();

  try {
    const raw = fs.readFileSync(eventLogFilePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as MissionControlEventLogEntry[];
  } catch {
    return [];
  }
}

function writeEventLog(events: MissionControlEventLogEntry[]) {
  ensureEventLogFile();

  fs.writeFileSync(
    eventLogFilePath,
    JSON.stringify(events, null, 2),
    "utf-8"
  );
}

function createEventId(source: string) {
  return `mission-control-event-${source.toLowerCase().replaceAll(" ", "-")}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export class MissionControlEventLog {
  static add(entry: {
    type: string;
    severity: MissionControlEventSeverity;
    source: string;
    message: string;
    payload?: unknown;
  }) {
    const events = readEventLog();

    const newEvent: MissionControlEventLogEntry = {
      id: createEventId(entry.source),
      type: entry.type,
      severity: entry.severity,
      source: entry.source,
      message: entry.message,
      payload: entry.payload ?? {},
      createdAt: new Date().toISOString(),
    };

    const nextEvents = [newEvent, ...events].slice(0, 250);

    writeEventLog(nextEvents);

    return newEvent;
  }

  static addDeduped(
    entry: {
      type: string;
      severity: MissionControlEventSeverity;
      source: string;
      message: string;
      payload?: unknown;
    },
    dedupeWindowMs = 5 * 60 * 1000
  ) {
    const events = readEventLog();
    const now = Date.now();

    const duplicate = events.find((event) => {
      const eventTime = new Date(event.createdAt).getTime();

      return (
        event.type === entry.type &&
        event.source === entry.source &&
        event.severity === entry.severity &&
        now - eventTime <= dedupeWindowMs
      );
    });

    if (duplicate) {
      return duplicate;
    }

    return this.add(entry);
  }

  static getAll() {
    return readEventLog();
  }

  static getLatest(limit = 25) {
    return readEventLog().slice(0, limit);
  }

  static getBySeverity(severity: MissionControlEventSeverity, limit = 25) {
    return readEventLog()
      .filter((event) => event.severity === severity)
      .slice(0, limit);
  }

  static getStats(): MissionControlEventLogStats {
    const events = readEventLog();

    return {
      totalEvents: events.length,
      infoEvents: events.filter((event) => event.severity === "INFO").length,
      warningEvents: events.filter((event) => event.severity === "WARNING").length,
      criticalEvents: events.filter((event) => event.severity === "CRITICAL").length,
      latestEvent: events[0] ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  static clear() {
    writeEventLog([]);
  }
}

