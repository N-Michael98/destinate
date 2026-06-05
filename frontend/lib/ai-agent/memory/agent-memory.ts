import fs from "fs";
import path from "path";

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

  static getEconomicRiskMemories(limit = 20) {
    return readMemory()
      .filter((item) => item.type.startsWith("ECONOMIC_RISK"))
      .slice(-limit)
      .reverse();
  }

  static getNewsRiskMemories(limit = 20) {
    return readMemory()
      .filter((item) => item.type.startsWith("NEWS_RISK"))
      .slice(-limit)
      .reverse();
  }

  static getPortfolioRiskMemories(limit = 20) {
    return readMemory()
      .filter((item) => item.type.startsWith("PORTFOLIO_RISK"))
      .slice(-limit)
      .reverse();
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

    const economicRiskMemories = memory.filter((item) =>
      item.type.startsWith("ECONOMIC_RISK")
    );

    const economicRiskBlocks = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_BLOCK"
    );

    const economicRiskReduced = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_REDUCED"
    );

    const economicRiskElevated = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_ELEVATED"
    );

    const economicRiskNormal = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_NORMAL"
    );

    const newsRiskMemories = memory.filter((item) =>
      item.type.startsWith("NEWS_RISK")
    );

    const newsRiskBlocks = memory.filter(
      (item) => item.type === "NEWS_RISK_BLOCK"
    );

    const newsRiskReduced = memory.filter(
      (item) => item.type === "NEWS_RISK_REDUCED"
    );

    const newsRiskElevated = memory.filter(
      (item) => item.type === "NEWS_RISK_ELEVATED"
    );

    const newsRiskNormal = memory.filter(
      (item) => item.type === "NEWS_RISK_NORMAL"
    );

    const portfolioRiskMemories = memory.filter((item) =>
      item.type.startsWith("PORTFOLIO_RISK")
    );

    const portfolioRiskBlocks = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_BLOCK"
    );

    const portfolioRiskReduced = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_REDUCED"
    );

    const portfolioRiskElevated = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_ELEVATED"
    );

    const portfolioRiskNormal = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_NORMAL"
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

    const averageEconomicRisk =
      economicRiskMemories.length > 0
        ? Number(
            (
              economicRiskMemories.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / economicRiskMemories.length
            ).toFixed(2)
          )
        : 0;

    const averageNewsRisk =
      newsRiskMemories.length > 0
        ? Number(
            (
              newsRiskMemories.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / newsRiskMemories.length
            ).toFixed(2)
          )
        : 0;

    const averagePortfolioRisk =
      portfolioRiskMemories.length > 0
        ? Number(
            (
              portfolioRiskMemories.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / portfolioRiskMemories.length
            ).toFixed(2)
          )
        : 0;

    return {
      totalMemories: memory.length,
      executedTrades: executed.length,
      rejectedTrades: rejected.length,

      economicRiskMemories: economicRiskMemories.length,
      economicRiskBlocks: economicRiskBlocks.length,
      economicRiskReduced: economicRiskReduced.length,
      economicRiskElevated: economicRiskElevated.length,
      economicRiskNormal: economicRiskNormal.length,

      newsRiskMemories: newsRiskMemories.length,
      newsRiskBlocks: newsRiskBlocks.length,
      newsRiskReduced: newsRiskReduced.length,
      newsRiskElevated: newsRiskElevated.length,
      newsRiskNormal: newsRiskNormal.length,

      portfolioRiskMemories: portfolioRiskMemories.length,
      portfolioRiskBlocks: portfolioRiskBlocks.length,
      portfolioRiskReduced: portfolioRiskReduced.length,
      portfolioRiskElevated: portfolioRiskElevated.length,
      portfolioRiskNormal: portfolioRiskNormal.length,

      averageConfidence,
      averageConsensus,
      averageEconomicRisk,
      averageNewsRisk,
      averagePortfolioRisk,

      updatedAt: new Date().toISOString(),
    };
  }
}