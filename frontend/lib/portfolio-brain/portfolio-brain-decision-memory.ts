import { dbGet, dbSet } from "../db-store";
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

const DB_KEY = "portfolio-brain-decision-memory";

declare global { var __pb_decision_memory__: PortfolioBrainDecisionMemoryEntry[] | undefined; }

function getCache(): PortfolioBrainDecisionMemoryEntry[] {
  return global.__pb_decision_memory__ ?? [];
}

function ensureLoaded() {
  if (global.__pb_decision_memory__ === undefined) {
    global.__pb_decision_memory__ = [];
    dbGet<PortfolioBrainDecisionMemoryEntry[]>(DB_KEY, []).then((data) => {
      global.__pb_decision_memory__ = data;
    }).catch(() => {});
  }
}

function persist() {
  dbSet(DB_KEY, getCache()).catch(() => {});
}

export function buildPortfolioBrainDecisionMemoryReport(
  memory?: PortfolioBrainDecisionMemoryEntry[]
): PortfolioBrainDecisionMemoryReport {
  ensureLoaded();
  const m = memory ?? getCache();
  const approved = m.filter((e) => e.approved).length;
  return {
    version: "V11.5.6",
    status: "READY",
    totalDecisionMemories: m.length,
    approvedMemories: approved,
    rejectedMemories: m.length - approved,
    latestMemory: m[0] ?? null,
    memory: m,
    recommendation:
      m.length === 0 ? "No decision memory yet."
      : approved > 0 ? "Decision memory active."
      : "No approved decisions yet.",
    updatedAt: new Date().toISOString(),
  };
}

export function savePortfolioBrainDecisionMemory(): PortfolioBrainDecisionMemoryReport {
  ensureLoaded();
  const strategySync = buildPortfolioBrainStrategySyncReport();
  const existing = getCache();
  const entries: PortfolioBrainDecisionMemoryEntry[] = strategySync.decisions.map((d) => ({
    id: `pb-decision-${d.symbol.toLowerCase()}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    version: "V11.5.6",
    symbol: d.symbol,
    strategy: d.strategy,
    direction: d.direction,
    confidence: d.confidence,
    executionBias: d.executionBias,
    approved: d.approved,
    reason: d.reason,
  }));
  const next = [...entries, ...existing].slice(0, 100);
  global.__pb_decision_memory__ = next;
  persist();
  return buildPortfolioBrainDecisionMemoryReport(next);
}

export function getPortfolioBrainDecisionMemory(): PortfolioBrainDecisionMemoryEntry[] {
  ensureLoaded();
  return getCache();
}

export async function init(): Promise<void> {
  global.__pb_decision_memory__ = await dbGet<PortfolioBrainDecisionMemoryEntry[]>(DB_KEY, []);
}
