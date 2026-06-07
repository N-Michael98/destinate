import type {
  ExecutionQueueSyncItem,
  TradeApprovalExecutionQueueInput,
  TradeApprovalExecutionQueueSyncReport,
} from "./trade-approval-execution-queue-types";

const tradeApprovalInput: TradeApprovalExecutionQueueInput = {
  finalTradeApprovalStatus: "REJECTED",
  allowTradeExecution: false,
  requireManualReview: false,
  positionSizeMultiplier: 0.35,
  approvalStrictness: "HIGH",
  passedGates: 0,
  strictPassedGates: 4,
  blockedGates: 1,
};

const candidateOrders = [
  {
    id: "candidate-spx500-long",
    symbol: "SPX500",
    strategy: "Trend Continuation Strategy",
    direction: "LONG" as const,
    basePositionSize: 1000,
  },
  {
    id: "candidate-nas100-long",
    symbol: "NAS100",
    strategy: "Trend Continuation Strategy",
    direction: "LONG" as const,
    basePositionSize: 1000,
  },
  {
    id: "candidate-xauusd-long",
    symbol: "XAUUSD",
    strategy: "Gold Breakout Strategy",
    direction: "LONG" as const,
    basePositionSize: 800,
  },
];

function buildQueueItem(
  candidate: typeof candidateOrders[number],
  input: TradeApprovalExecutionQueueInput,
): ExecutionQueueSyncItem {
  const adjustedPositionSize = Number(
    (candidate.basePositionSize * input.positionSizeMultiplier).toFixed(2),
  );

  if (input.finalTradeApprovalStatus === "REJECTED" || !input.allowTradeExecution) {
    return {
      id: `execution-sync-blocked-${candidate.symbol.toLowerCase()}`,
      symbol: candidate.symbol,
      strategy: candidate.strategy,
      direction: candidate.direction,
      requestedAction: "BLOCK",
      queueStatus: "BLOCKED",
      basePositionSize: candidate.basePositionSize,
      adjustedPositionSize: 0,
      positionSizeMultiplier: input.positionSizeMultiplier,
      approvalStatus: input.finalTradeApprovalStatus,
      reason: `${candidate.symbol} execution blocked because Trade Approval status is ${input.finalTradeApprovalStatus}.`,
      createdAt: new Date().toISOString(),
    };
  }

  if (input.finalTradeApprovalStatus === "STRICT_APPROVAL_REQUIRED") {
    return {
      id: `execution-sync-waiting-${candidate.symbol.toLowerCase()}`,
      symbol: candidate.symbol,
      strategy: candidate.strategy,
      direction: candidate.direction,
      requestedAction: "WAIT",
      queueStatus: input.requireManualReview
        ? "WAITING_FOR_APPROVAL"
        : "WAITING_FOR_RISK_IMPROVEMENT",
      basePositionSize: candidate.basePositionSize,
      adjustedPositionSize,
      positionSizeMultiplier: input.positionSizeMultiplier,
      approvalStatus: input.finalTradeApprovalStatus,
      reason: `${candidate.symbol} requires strict approval before execution. Position size would be reduced to ${adjustedPositionSize}.`,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    id: `execution-sync-queued-${candidate.symbol.toLowerCase()}`,
    symbol: candidate.symbol,
    strategy: candidate.strategy,
    direction: candidate.direction,
    requestedAction: "OPEN_TRADE",
    queueStatus: "QUEUED",
    basePositionSize: candidate.basePositionSize,
    adjustedPositionSize,
    positionSizeMultiplier: input.positionSizeMultiplier,
    approvalStatus: input.finalTradeApprovalStatus,
    reason: `${candidate.symbol} approved and queued for execution with adjusted position size ${adjustedPositionSize}.`,
    createdAt: new Date().toISOString(),
  };
}

export function getTradeApprovalExecutionQueueSyncReport(): TradeApprovalExecutionQueueSyncReport {
  const queueItems = candidateOrders.map((candidate) =>
    buildQueueItem(candidate, tradeApprovalInput),
  );

  const queuedItems = queueItems.filter(
    (item) => item.queueStatus === "QUEUED",
  ).length;

  const blockedItems = queueItems.filter(
    (item) => item.queueStatus === "BLOCKED",
  ).length;

  const waitingItems = queueItems.filter(
    (item) =>
      item.queueStatus === "WAITING_FOR_APPROVAL" ||
      item.queueStatus === "WAITING_FOR_RISK_IMPROVEMENT",
  ).length;

  const executionAllowed = queuedItems > 0;

  const executionQueueMode =
    blockedItems === queueItems.length
      ? "BLOCKED"
      : waitingItems > 0
        ? "WAITING"
        : "ACTIVE";

  const recommendation =
    executionQueueMode === "BLOCKED"
      ? "Execution Queue should not place orders. Wait for Trade Approval risk gate to improve."
      : executionQueueMode === "WAITING"
        ? "Execution Queue should wait for stricter confirmation or manual review before placing orders."
        : "Execution Queue may place approved orders with adjusted position sizing.";

  return {
    version: "V11.8.8",
    status: "READY",
    mode: "SIMULATION",
    input: tradeApprovalInput,
    totalQueueItems: queueItems.length,
    queuedItems,
    blockedItems,
    waitingItems,
    executionAllowed,
    executionQueueMode,
    queueItems,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
