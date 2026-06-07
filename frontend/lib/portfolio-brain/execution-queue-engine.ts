import { buildTradeApprovalEngineReport } from "./trade-approval-engine";

export type ExecutionQueueStatus = "QUEUED" | "BLOCKED";

export type ExecutionQueueItem = {
  id: string;
  rank: number;
  symbol: string;
  strategy: string;
  direction: string;
  adaptiveConfidence: number;
  strategyWeight: number;
  riskState: string;
  riskPerTradePercent: number;
  maxRiskAmount: number;
  priorityScore: number;
  status: ExecutionQueueStatus;
  brokerTarget: "PAPER" | "CAPITAL_COM" | "IC_MARKETS";
  executionMode: "SIMULATION" | "DEMO" | "LIVE_BLOCKED";
  reason: string;
};

export type ExecutionQueueEngineReport = {
  version: string;
  status: "READY";
  totalApprovedTrades: number;
  queuedTrades: number;
  blockedTrades: number;
  bestQueueItem: ExecutionQueueItem | null;
  queue: ExecutionQueueItem[];
  brokerMode: "PAPER";
  liveTradingEnabled: false;
  recommendation: string;
  updatedAt: string;
};

function calculatePriorityScore(input: {
  adaptiveConfidence: number;
  strategyWeight: number;
  maxRiskAmount: number;
}): number {
  const riskPower = Math.min(100, input.maxRiskAmount);
  const raw =
    input.adaptiveConfidence * 0.45 +
    input.strategyWeight * 0.45 +
    riskPower * 0.1;

  return Math.round(raw);
}

function createQueueId(symbol: string): string {
  return `execution-queue-${symbol.toLowerCase()}-${Date.now()}`;
}

export function buildExecutionQueueEngineReport(): ExecutionQueueEngineReport {
  const tradeApproval = buildTradeApprovalEngineReport();

  const approvedTrades = tradeApproval.decisions.filter(
    (decision) => decision.approved
  );

  const queue = approvedTrades
    .map((trade) => {
      const priorityScore = calculatePriorityScore({
        adaptiveConfidence: trade.adaptiveConfidence,
        strategyWeight: trade.strategyWeight,
        maxRiskAmount: trade.maxRiskAmount,
      });

      return {
        id: createQueueId(trade.symbol),
        rank: 0,
        symbol: trade.symbol,
        strategy: trade.strategy,
        direction: trade.direction,
        adaptiveConfidence: trade.adaptiveConfidence,
        strategyWeight: trade.strategyWeight,
        riskState: trade.riskState,
        riskPerTradePercent: trade.riskPerTradePercent,
        maxRiskAmount: trade.maxRiskAmount,
        priorityScore,
        status: "QUEUED" as ExecutionQueueStatus,
        brokerTarget: "PAPER" as const,
        executionMode: "SIMULATION" as const,
        reason: `${trade.symbol} queued for paper execution with priority score ${priorityScore}.`,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const bestQueueItem = queue[0] ?? null;

  const recommendation =
    bestQueueItem === null
      ? "No approved trades available for execution queue."
      : `${bestQueueItem.symbol} is first in the execution queue with priority score ${bestQueueItem.priorityScore}.`;

  return {
    version: "V11.6.4",
    status: "READY",
    totalApprovedTrades: approvedTrades.length,
    queuedTrades: queue.length,
    blockedTrades: tradeApproval.rejectedTrades,
    bestQueueItem,
    queue,
    brokerMode: "PAPER",
    liveTradingEnabled: false,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
