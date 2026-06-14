import { dbGet, dbSet } from "../../db-store";

export type AgentMemoryType =
  | "AI_TRADE_EXECUTED"
  | "AI_TRADE_REJECTED"
  | "AI_REVIEW"
  | "SYSTEM"
  | "ECONOMIC_RISK_BLOCK"
  | "ECONOMIC_RISK_REDUCED"
  | "ECONOMIC_RISK_ELEVATED"
  | "ECONOMIC_RISK_NORMAL"
  | "NEWS_RISK_BLOCK"
  | "NEWS_RISK_REDUCED"
  | "NEWS_RISK_ELEVATED"
  | "NEWS_RISK_NORMAL"
  | "PORTFOLIO_RISK_BLOCK"
  | "PORTFOLIO_RISK_REDUCED"
  | "PORTFOLIO_RISK_ELEVATED"
  | "PORTFOLIO_RISK_NORMAL";

export type AgentMemoryEntry = {
  id: string;
  type: AgentMemoryType;
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

const DB_KEY = "ai-agent-memory";

declare global { var __agent_memory__: AgentMemoryEntry[] | undefined; }

function getCache(): AgentMemoryEntry[] {
  return global.__agent_memory__ ?? [];
}

// Trigger async load on first access
function ensureLoaded() {
  if (global.__agent_memory__ === undefined) {
    global.__agent_memory__ = [];
    dbGet<AgentMemoryEntry[]>(DB_KEY, []).then((data) => {
      global.__agent_memory__ = data;
    }).catch(() => {});
  }
}

function persist() {
  dbSet(DB_KEY, getCache()).catch(() => {});
}

export class AgentMemory {
  static add(entry: Omit<AgentMemoryEntry, "id" | "createdAt">): AgentMemoryEntry {
    ensureLoaded();
    const newEntry: AgentMemoryEntry = {
      id: `ai-memory-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    const memory = getCache();
    memory.push(newEntry);
    global.__agent_memory__ = memory;
    persist();
    return newEntry;
  }

  static getAll(): AgentMemoryEntry[] {
    ensureLoaded();
    return getCache();
  }

  static getLatest(limit = 10): AgentMemoryEntry[] {
    ensureLoaded();
    return getCache().slice(-limit).reverse();
  }

  static getEconomicRiskMemories(limit = 20): AgentMemoryEntry[] {
    ensureLoaded();
    return getCache().filter((i) => i.type.startsWith("ECONOMIC_RISK")).slice(-limit).reverse();
  }

  static getNewsRiskMemories(limit = 20): AgentMemoryEntry[] {
    ensureLoaded();
    return getCache().filter((i) => i.type.startsWith("NEWS_RISK")).slice(-limit).reverse();
  }

  static getPortfolioRiskMemories(limit = 20): AgentMemoryEntry[] {
    ensureLoaded();
    return getCache().filter((i) => i.type.startsWith("PORTFOLIO_RISK")).slice(-limit).reverse();
  }

  static clear(): void {
    global.__agent_memory__ = [];
    persist();
  }

  static getStats() {
    ensureLoaded();
    const memory = getCache();
    const executed = memory.filter((i) => i.type === "AI_TRADE_EXECUTED");
    const rejected = memory.filter((i) => i.type === "AI_TRADE_REJECTED");
    const withConfidence = memory.filter((i) => typeof i.confidence === "number");
    const withConsensus = memory.filter((i) => typeof i.consensusScore === "number");
    const withRisk = memory.filter((i) => typeof i.riskScore === "number");
    const avg = (arr: AgentMemoryEntry[], key: keyof AgentMemoryEntry) =>
      arr.length > 0 ? arr.reduce((s, i) => s + (Number(i[key]) || 0), 0) / arr.length : 0;
    return {
      totalMemories: memory.length,
      executedTrades: executed.length,
      rejectedTrades: rejected.length,
      averageConfidence: Math.round(avg(withConfidence, "confidence") * 10) / 10,
      averageConsensus: Math.round(avg(withConsensus, "consensusScore") * 10) / 10,
      averageRiskScore: Math.round(avg(withRisk, "riskScore") * 10) / 10,
      averageNewsRisk: 0,
      averageEconomicRisk: 0,
      averagePortfolioRisk: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  // Load from DB into cache on server startup
  static async init(): Promise<void> {
    global.__agent_memory__ = await dbGet<AgentMemoryEntry[]>(DB_KEY, []);
  }
}
