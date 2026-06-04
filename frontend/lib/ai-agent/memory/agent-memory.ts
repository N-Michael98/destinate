import fs from "fs";
import path from "path";

export type AgentMemoryEntry = {
  id: string;
  type:
    | "AI_TRADE_EXECUTED"
    | "AI_TRADE_REJECTED"
    | "AI_REVIEW"
    | "SYSTEM";
  symbol?: string;
  direction?: string;
  confidence?: number;
  approved?: boolean;
  executed?: boolean;
  consensusScore?: number;
  riskScore?: number;
  reason: string;
  payload: unknown;
  createdAt: string;
};

const memoryFilePath = path.join(
  process.cwd(),
  "lib",
  "data",
  "ai-agent-memory.json"
);

function ensureMemoryFile() {
  const directory = path.dirname(memoryFilePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(memoryFilePath)) {
    fs.writeFileSync(memoryFilePath, "[]", "utf-8");
  }
}

function readMemory(): AgentMemoryEntry[] {
  ensureMemoryFile();

  try {
    const raw = fs.readFileSync(memoryFilePath, "utf-8");
    return JSON.parse(raw) as AgentMemoryEntry[];
  } catch {
    return [];
  }
}

function writeMemory(memory: AgentMemoryEntry[]) {
  ensureMemoryFile();

  fs.writeFileSync(
    memoryFilePath,
    JSON.stringify(memory, null, 2),
    "utf-8"
  );
}

export class AgentMemory {
  static add(entry: Omit<AgentMemoryEntry, "id" | "createdAt">) {
    const memory = readMemory();

    const newEntry: AgentMemoryEntry = {
      id: `ai-memory-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };

    memory.push(newEntry);
    writeMemory(memory);

    return newEntry;
  }

  static getAll() {
    return readMemory();
  }

  static getLatest(limit = 10) {
    return readMemory().slice(-limit).reverse();
  }

  static clear() {
    writeMemory([]);
  }

  static getStats() {
    const memory = readMemory();

    const executed = memory.filter(
      (item) => item.type === "AI_TRADE_EXECUTED"
    );

    const rejected = memory.filter(
      (item) => item.type === "AI_TRADE_REJECTED"
    );

    const averageConfidence =
      memory.length > 0
        ? Number(
            (
              memory.reduce(
                (sum, item) => sum + Number(item.confidence ?? 0),
                0
              ) / memory.length
            ).toFixed(2)
          )
        : 0;

    const averageConsensus =
      memory.length > 0
        ? Number(
            (
              memory.reduce(
                (sum, item) => sum + Number(item.consensusScore ?? 0),
                0
              ) / memory.length
            ).toFixed(2)
          )
        : 0;

    return {
      totalMemories: memory.length,
      executedTrades: executed.length,
      rejectedTrades: rejected.length,
      averageConfidence,
      averageConsensus,
      updatedAt: new Date().toISOString(),
    };
  }
}