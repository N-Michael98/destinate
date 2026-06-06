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

const portfolioBrainDecisionMemory: PortfolioBrainDecisionMemoryEntry[] = [];

function createMemoryId(symbol: string): string {
  return `portfolio-brain-decision-${symbol.toLowerCase()}-${Date.now()}`;
}

export function savePortfolioBrainDecisionMemory(): PortfolioBrainDecisionMemoryReport {
  const strategySync = buildPortfolioBrainStrategySyncReport();

  const entries = strategySync.decisions.map((decision) => ({
    id: createMemoryId(decision.symbol),
    createdAt: new Date().toISOString(),
    version: "V11.5.3",
    symbol: decision.symbol,
    strategy: decision.strategy,
    direction: decision.direction,
    confidence: decision.confidence,
    executionBias: decision.executionBias,
    approved: decision.approved,
    reason: decision.reason,
  }));

  portfolioBrainDecisionMemory.unshift(...entries);

  return buildPortfolioBrainDecisionMemoryReport();
}

export function getPortfolioBrainDecisionMemory(): PortfolioBrainDecisionMemoryEntry[] {
  return portfolioBrainDecisionMemory;
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
        ? "Portfolio Brain decision memory is active. Approved strategy decisions are now available for outcome and adaptive learning."
        : "Portfolio Brain decision memory is active, but no approved strategy decisions were stored yet.";

  return {
    version: "V11.5.3",
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