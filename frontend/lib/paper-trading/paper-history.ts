import fs from "fs";
import path from "path";

type PaperHistoryEvent = {
  id: string;
  type: string;
  entity: "ORDER" | "POSITION" | "SYSTEM";
  event: string;
  timestamp: string;
  payload: unknown;
};

const historyFilePath = path.join(
  process.cwd(),
  "lib",
  "data",
  "paper-history.json"
);

function ensureHistoryFile() {
  const directory = path.dirname(historyFilePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(historyFilePath)) {
    fs.writeFileSync(historyFilePath, "[]", "utf-8");
  }
}

function readHistory(): PaperHistoryEvent[] {
  ensureHistoryFile();

  try {
    const raw = fs.readFileSync(historyFilePath, "utf-8");
    return JSON.parse(raw) as PaperHistoryEvent[];
  } catch {
    return [];
  }
}

function writeHistory(history: PaperHistoryEvent[]) {
  ensureHistoryFile();
  fs.writeFileSync(
    historyFilePath,
    JSON.stringify(history, null, 2),
    "utf-8"
  );
}

export class PaperHistory {
  static addOrderEvent(order: unknown, event: string) {
    const history = readHistory();

    history.push({
      id: `paper-history-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      type: event,
      entity: "ORDER",
      event,
      timestamp: new Date().toISOString(),
      payload: order,
    });

    writeHistory(history);
  }

  static addPositionEvent(position: unknown, event: string) {
    const history = readHistory();

    history.push({
      id: `paper-history-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      type: event,
      entity: "POSITION",
      event,
      timestamp: new Date().toISOString(),
      payload: position,
    });

    writeHistory(history);
  }

  static addSystemEvent(event: string, payload: unknown = {}) {
    const history = readHistory();

    history.push({
      id: `paper-history-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      type: event,
      entity: "SYSTEM",
      event,
      timestamp: new Date().toISOString(),
      payload,
    });

    writeHistory(history);
  }

  static getAll() {
    return readHistory();
  }

  static clear() {
    writeHistory([]);
  }
}