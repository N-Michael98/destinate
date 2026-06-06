import fs from "fs";
import path from "path";
import { buildPortfolioBrainStrategySyncReport } from "./portfolio-brain-strategy-sync";

export type PortfolioBrainDecisionMemoryEntry = {
  id: string;
  createdAt: string;
  version: string;
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  executionBias: string;
  approved: boolean;
  reason: string;
};

export type PortfolioBrainDecisionMemoryReport = {
  version: string;
  status: "READY";
  totalDecisionMemories: number;
  approvedMemories: number;
  rejectedMemories: number;
  latestMemory: PortfolioBrainDecisionMemoryEntry | null;
  memory: PortfolioBrainDecisionMemoryEntry[];
  recommendation: string;
  updatedAt: string;
};

const memoryFilePath = path.join(
  process.cwd(),
  "lib",
  "data",
  "portfolio-brain-decision-memory.json"
);

function ensureMemoryFile() {
  const directory = path.dirname(memoryFilePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(memoryFilePath)) {
    fs.writeFileSync(memoryFilePath, "[]", "utf8");
  }
}

function readMemoryFile(): PortfolioBrainDecisionMemoryEntry[] {
  ensureMemoryFile();

  try {
    const raw = fs.readFileSync(memoryFilePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function writeMemoryFile(memory: PortfolioBrainDecisionMemoryEntry[]) {
  ensureMemoryFile();
  fs.writeFileSync(memoryFilePath, JSON.stringify(memory, null, 2), "utf8");
}

function createMemoryId(symbol: string): string {
  return `portfolio-brain-decision-${symbol.toLowerCase()}-${Date.now()}`;
}

export function savePortfolioBrainDecisionMemory(): PortfolioBrainDecisionMemoryReport {
  const strategySync = buildPortfolioBrainStrategySyncReport();
  const existingMemory = readMemoryFile();

  const entries = strategySync.decisions.map((decision) => ({
    id: createMemoryId(decision.symbol),
    createdAt: new Date().toISOString(),
    version: "V11.5.6",
    symbol: decision.symbol,
    strategy: decision.strategy,
    direction: decision.direction,
    confidence: decision.confidence,
    executionBias: decision.executionBias,
    approved: decision.approved,
    reason: decision.reason,
  }));

  const nextMemory = [...entries, ...existingMemory].slice(0, 100);

  writeMemoryFile(nextMemory);

  return buildPortfolioBrainDecisionMemoryReport();
}

export function getPortfolioBrainDecisionMemory(): PortfolioBrainDecisionMemoryEntry[] {
  return readMemoryFile();
}

export function buildPortfolioBrainDecisionMemoryReport(): PortfolioBrainDecisionMemoryReport {
  const memory = getPortfolioBrainDecisionMemory();

  const approvedMemories = memory.filter((entry) => entry.approved).length;
  const rejectedMemories = memory.filter((entry) => !entry.approved).length;

  const latestMemory = memory[0] ?? null;

  const recommendation =
    memory.length === 0
      ? "No Portfolio Brain decision memory stored yet."
      : approvedMemories > 0
        ? "Portfolio Brain decision memory is active and persisted. Approved strategy decisions are available for outcome and adaptive learning."
        : "Portfolio Brain decision memory is persisted, but no approved strategy decisions were stored yet.";

  return {
    version: "V11.5.6",
    status: "READY",
    totalDecisionMemories: memory.length,
    approvedMemories,
    rejectedMemories,
    latestMemory,
    memory,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}