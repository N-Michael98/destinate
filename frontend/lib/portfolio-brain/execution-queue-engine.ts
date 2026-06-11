import { buildTradeApprovalEngineReport } from "./trade-approval-engine";
import { isCapitalConnected } from "../capital-com/capital-com-session";

export type ExecutionQueueStatus = "QUEUED" | "BLOCKED";
export type BrokerTarget = "PAPER" | "CAPITAL_COM" | "IC_MARKETS";
export type ExecutionMode = "SIMULATION" | "DEMO" | "LIVE_BLOCKED";

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
  brokerTarget: BrokerTarget;
  executionMode: ExecutionMode;
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
  brokerMode: BrokerTarget;
  executionMode: ExecutionMode;
  capitalComActive: boolean;
  icMarketsActive: boolean;
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
  return Math.round(input.adaptiveConfidence * 0.45 + input.strategyWeight * 0.45 + riskPower * 0.1);
}

function createQueueId(symbol: string): string {
  return `eq-${symbol.toLowerCase()}-${Date.now()}`;
}

// Determine routing: Capital.com DEMO > IC Markets DEMO > Paper fallback
function resolveBrokerTarget(): { brokerTarget: BrokerTarget; executionMode: ExecutionMode } {
  const capitalConnected = isCapitalConnected();
  // IC Markets connection check would go here when implemented
  const icMarketsConnected = false;

  if (capitalConnected) return { brokerTarget: "CAPITAL_COM", executionMode: "DEMO" };
  if (icMarketsConnected) return { brokerTarget: "IC_MARKETS", executionMode: "DEMO" };
  return { brokerTarget: "PAPER", executionMode: "SIMULATION" };
}

export function buildExecutionQueueEngineReport(): ExecutionQueueEngineReport {
  const tradeApproval = buildTradeApprovalEngineReport();
  const approvedTrades = tradeApproval.decisions.filter((d) => d.approved);
  const { brokerTarget, executionMode } = resolveBrokerTarget();
  const capitalComActive = brokerTarget === "CAPITAL_COM";
  const icMarketsActive = brokerTarget === "IC_MARKETS";

  const queue = approvedTrades
    .map((trade) => {
      const priorityScore = calculatePriorityScore({
        adaptiveConfidence: trade.adaptiveConfidence,
        strategyWeight: trade.strategyWeight,
        maxRiskAmount: trade.maxRiskAmount,
      });

      const reason = capitalComActive
        ? `${trade.symbol} → Capital.com DEMO · Priority ${priorityScore} · ${trade.direction}`
        : icMarketsActive
        ? `${trade.symbol} → IC Markets DEMO · Priority ${priorityScore} · ${trade.direction}`
        : `${trade.symbol} queued for paper execution · Priority ${priorityScore}`;

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
        brokerTarget,
        executionMode,
        reason,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const bestQueueItem = queue[0] ?? null;

  const recommendation = bestQueueItem === null
    ? "No approved trades in execution queue."
    : capitalComActive
    ? `${bestQueueItem.symbol} bereit für Capital.com DEMO — Priority ${bestQueueItem.priorityScore} · ${bestQueueItem.direction}`
    : `${bestQueueItem.symbol} in Paper Queue — Priority ${bestQueueItem.priorityScore}`;

  return {
    version: "V17.4.0",
    status: "READY",
    totalApprovedTrades: approvedTrades.length,
    queuedTrades: queue.length,
    blockedTrades: tradeApproval.rejectedTrades,
    bestQueueItem,
    queue,
    brokerMode: brokerTarget,
    executionMode,
    capitalComActive,
    icMarketsActive,
    liveTradingEnabled: false,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
