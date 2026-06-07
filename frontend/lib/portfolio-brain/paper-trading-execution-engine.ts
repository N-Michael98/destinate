import { buildExecutionQueueEngineReport } from "./execution-queue-engine";

export type PaperExecutionStatus =
  | "SIMULATED_OPEN"
  | "SIMULATED_CLOSED"
  | "SKIPPED";

export type PaperTradeExecution = {
  id: string;
  queueId: string;
  symbol: string;
  strategy: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPerTradePercent: number;
  maxRiskAmount: number;
  simulatedPositionSize: number;
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  simulatedPnlAmount: number;
  simulatedPnlPercent: number;
  status: PaperExecutionStatus;
  reason: string;
  createdAt: string;
};

export type PaperTradingExecutionReport = {
  version: string;
  status: "READY";
  mode: "PAPER_SIMULATION";
  totalQueueItems: number;
  executedTrades: number;
  skippedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  openTrades: number;
  totalSimulatedPnlAmount: number;
  averageSimulatedPnlPercent: number;
  bestTrade: PaperTradeExecution | null;
  worstTrade: PaperTradeExecution | null;
  executions: PaperTradeExecution[];
  recommendation: string;
  updatedAt: string;
};

function getMockPrice(symbol: string): number {
  const prices: Record<string, number> = {
    SPX500: 5350,
    NAS100: 19000,
    XAUUSD: 2350,
    EURUSD: 1.08,
    GBPUSD: 1.27,
    BTCUSD: 68000,
    USOIL: 78,
  };

  return prices[symbol] ?? 100;
}

function buildTradeLevels(input: {
  symbol: string;
  direction: string;
  riskAmount: number;
}) {
  const entryPrice = getMockPrice(input.symbol);

  const riskDistancePercent =
    input.symbol.includes("USD") && entryPrice < 10 ? 0.005 : 0.01;

  const riskDistance = Number((entryPrice * riskDistancePercent).toFixed(4));

  if (input.direction === "SHORT") {
    return {
      entryPrice,
      stopLoss: Number((entryPrice + riskDistance).toFixed(4)),
      takeProfit: Number((entryPrice - riskDistance * 2).toFixed(4)),
    };
  }

  return {
    entryPrice,
    stopLoss: Number((entryPrice - riskDistance).toFixed(4)),
    takeProfit: Number((entryPrice + riskDistance * 2).toFixed(4)),
  };
}

function simulateExecutionOutcome(input: {
  adaptiveConfidence: number;
  priorityScore: number;
}): {
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  simulatedPnlPercent: number;
} {
  if (input.adaptiveConfidence >= 70 && input.priorityScore >= 80) {
    return {
      simulatedOutcome: "WIN",
      simulatedPnlPercent: 1.5,
    };
  }

  if (input.adaptiveConfidence >= 60) {
    return {
      simulatedOutcome: "BREAKEVEN",
      simulatedPnlPercent: 0.1,
    };
  }

  return {
    simulatedOutcome: "LOSS",
    simulatedPnlPercent: -1,
  };
}

function createExecutionId(symbol: string): string {
  return `paper-execution-${symbol.toLowerCase()}-${Date.now()}`;
}

export function buildPaperTradingExecutionReport(): PaperTradingExecutionReport {
  const queueReport = buildExecutionQueueEngineReport();

  const executions = queueReport.queue.map((queueItem) => {
    const levels = buildTradeLevels({
      symbol: queueItem.symbol,
      direction: queueItem.direction,
      riskAmount: queueItem.maxRiskAmount,
    });

    const outcome = simulateExecutionOutcome({
      adaptiveConfidence: queueItem.adaptiveConfidence,
      priorityScore: queueItem.priorityScore,
    });

    const simulatedPositionSize =
      queueItem.maxRiskAmount === 0
        ? 0
        : Number((queueItem.maxRiskAmount / Math.abs(levels.entryPrice - levels.stopLoss)).toFixed(4));

    const simulatedPnlAmount = Number(
      ((queueItem.maxRiskAmount * outcome.simulatedPnlPercent) / queueItem.riskPerTradePercent).toFixed(2)
    );

    const status: PaperExecutionStatus =
      outcome.simulatedOutcome === "OPEN"
        ? "SIMULATED_OPEN"
        : "SIMULATED_CLOSED";

    return {
      id: createExecutionId(queueItem.symbol),
      queueId: queueItem.id,
      symbol: queueItem.symbol,
      strategy: queueItem.strategy,
      direction: queueItem.direction,
      entryPrice: levels.entryPrice,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      riskPerTradePercent: queueItem.riskPerTradePercent,
      maxRiskAmount: queueItem.maxRiskAmount,
      simulatedPositionSize,
      simulatedOutcome: outcome.simulatedOutcome,
      simulatedPnlAmount,
      simulatedPnlPercent: outcome.simulatedPnlPercent,
      status,
      reason: `${queueItem.symbol} paper execution simulated with ${outcome.simulatedOutcome} outcome and ${outcome.simulatedPnlPercent}% PnL.`,
      createdAt: new Date().toISOString(),
    };
  });

  const wins = executions.filter((trade) => trade.simulatedOutcome === "WIN").length;
  const losses = executions.filter((trade) => trade.simulatedOutcome === "LOSS").length;
  const breakevens = executions.filter((trade) => trade.simulatedOutcome === "BREAKEVEN").length;
  const openTrades = executions.filter((trade) => trade.simulatedOutcome === "OPEN").length;

  const closedTrades = executions.filter((trade) => trade.simulatedOutcome !== "OPEN");

  const totalSimulatedPnlAmount = Number(
    executions.reduce((sum, trade) => sum + trade.simulatedPnlAmount, 0).toFixed(2)
  );

  const averageSimulatedPnlPercent =
    closedTrades.length === 0
      ? 0
      : Number(
          (
            closedTrades.reduce((sum, trade) => sum + trade.simulatedPnlPercent, 0) /
            closedTrades.length
          ).toFixed(2)
        );

  const bestTrade =
    executions.length === 0
      ? null
      : [...executions].sort((a, b) => b.simulatedPnlAmount - a.simulatedPnlAmount)[0];

  const worstTrade =
    executions.length === 0
      ? null
      : [...executions].sort((a, b) => a.simulatedPnlAmount - b.simulatedPnlAmount)[0];

  const recommendation =
    executions.length === 0
      ? "No queued trades available for paper execution."
      : `${executions.length} queued trades were simulated in paper mode. Total simulated PnL: ${totalSimulatedPnlAmount}.`;

  return {
    version: "V11.6.6",
    status: "READY",
    mode: "PAPER_SIMULATION",
    totalQueueItems: queueReport.queue.length,
    executedTrades: executions.length,
    skippedTrades: queueReport.blockedTrades,
    wins,
    losses,
    breakevens,
    openTrades,
    totalSimulatedPnlAmount,
    averageSimulatedPnlPercent,
    bestTrade,
    worstTrade,
    executions,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
