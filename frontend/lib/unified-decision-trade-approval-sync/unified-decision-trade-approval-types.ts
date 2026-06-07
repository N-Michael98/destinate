export type ApprovalGateStatus =
  | "PASS"
  | "STRICT_PASS"
  | "BLOCK";

export type ApprovalStrictness =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "EXTREME";

export type UnifiedDecisionTradeApprovalInput = {
  finalDecisionMode: "AGGRESSIVE" | "NORMAL" | "DEFENSIVE" | "BLOCKED";
  finalConfidenceScore: number;
  finalRiskScore: number;
  finalStrategyScore: number;
  tradingAllowed: boolean;
  aggressiveTradingAllowed: boolean;
  normalTradingAllowed: boolean;
  defensiveTradingRequired: boolean;
  positionSizeMultiplier: number;
  approvalStrictness: ApprovalStrictness;
  actions: string[];
};

export type TradeApprovalGate = {
  id: string;
  name: string;
  status: ApprovalGateStatus;
  required: boolean;
  score: number;
  threshold: number;
  reason: string;
};

export type UnifiedDecisionTradeApprovalSyncReport = {
  version: "V11.8.6";
  status: "READY";
  mode: "SIMULATION";
  input: UnifiedDecisionTradeApprovalInput;
  gates: TradeApprovalGate[];
  passedGates: number;
  strictPassedGates: number;
  blockedGates: number;
  finalTradeApprovalStatus: "APPROVED" | "STRICT_APPROVAL_REQUIRED" | "REJECTED";
  allowTradeExecution: boolean;
  requireManualReview: boolean;
  positionSizeMultiplier: number;
  approvalStrictness: ApprovalStrictness;
  recommendation: string;
  updatedAt: string;
};
