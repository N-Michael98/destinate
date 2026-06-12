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

function historyFilePath(slot: string) {
  return path.join(process.cwd(), "lib", "data", `paper-history-${slot}.json`);
}

function ensureHistoryFile(slot: string) {
  const filePath = historyFilePath(slot);
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf-8");
}

function readHistory(slot: string): PaperHistoryEvent[] {
  ensureHistoryFile(slot);
  try {
    return JSON.parse(fs.readFileSync(historyFilePath(slot), "utf-8")) as PaperHistoryEvent[];
  } catch {
    return [];
  }
}

function writeHistory(slot: string, history: PaperHistoryEvent[]) {
  ensureHistoryFile(slot);
  fs.writeFileSync(historyFilePath(slot), JSON.stringify(history, null, 2), "utf-8");
}

export class PaperHistory {
  static addOrderEvent(order: unknown, event: string, slot = "capital") {
    const history = readHistory(slot);
    history.push({
      id: `paper-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: event, entity: "ORDER", event, timestamp: new Date().toISOString(), payload: order,
    });
    writeHistory(slot, history);
  }

  static addPositionEvent(position: unknown, event: string, slot = "capital") {
    const history = readHistory(slot);
    history.push({
      id: `paper-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: event, entity: "POSITION", event, timestamp: new Date().toISOString(), payload: position,
    });
    writeHistory(slot, history);
  }

  static addSystemEvent(event: string, payload: unknown = {}, slot = "capital") {
    const history = readHistory(slot);
    history.push({
      id: `paper-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: event, entity: "SYSTEM", event, timestamp: new Date().toISOString(), payload,
    });
    writeHistory(slot, history);
  }

  static getAll(slot = "capital") {
    return readHistory(slot);
  }

  static clear(slot = "capital") {
    writeHistory(slot, []);
  }
}
