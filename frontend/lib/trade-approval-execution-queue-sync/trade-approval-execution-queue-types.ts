export type ExecutionQueueSyncStatus =
  | "QUEUED"
  | "BLOCKED"
  | "WAITING_FOR_APPROVAL"
  | "WAITING_FOR_RISK_IMPROVEMENT";

export type TradeApprovalExecutionQueueInput = {
  finalTradeApprovalStatus: "APPROVED" | "STRICT_APPROVAL_REQUIRED" | "REJECTED";
  allowTradeExecution: boolean;
  requireManualReview: boolean;
  positionSizeMultiplier: number;
  approvalStrictness: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  passedGates: number;
  strictPassedGates: number;
  blockedGates: number;
};

export type ExecutionQueueSyncItem = {
  id: string;
  symbol: string;
  strategy: string;
  direction: "LONG" | "SHORT";
  requestedAction: "OPEN_TRADE" | "WAIT" | "BLOCK";
  queueStatus: ExecutionQueueSyncStatus;
  basePositionSize: number;
  adjustedPositionSize: number;
  positionSizeMultiplier: number;
  approvalStatus: string;
  reason: string;
  createdAt: string;
};

export type TradeApprovalExecutionQueueSyncReport = {
  version: "V11.8.8";
  status: "READY";
  mode: "SIMULATION";
  input: TradeApprovalExecutionQueueInput;
  totalQueueItems: number;
  queuedItems: number;
  blockedItems: number;
  waitingItems: number;
  executionAllowed: boolean;
  executionQueueMode: "ACTIVE" | "BLOCKED" | "WAITING";
  queueItems: ExecutionQueueSyncItem[];
  recommendation: string;
  updatedAt: string;
};
