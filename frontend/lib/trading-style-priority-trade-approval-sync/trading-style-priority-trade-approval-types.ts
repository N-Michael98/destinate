export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING" | "NONE";

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type StyleApprovalStatus =
  | "APPROVED"
  | "STRICT_APPROVAL_REQUIRED"
  | "REJECTED"
  | "BLOCKED";

export type StyleApprovalGateStatus =
  | "PASS"
  | "STRICT_PASS"
  | "FAIL"
  | "BLOCK";

export type StylePriorityTradeApprovalInput = {
  symbol: string;
  primaryStyle: TradingStyle;
  secondaryStyle: TradingStyle;
  activeDirection: Direction;
  unifiedDecisionMode: string;
  portfolioBrainRoute: string;
  priorityScore: number;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  requiresStrictApproval: boolean;
  executionAllowed: boolean;
  approvalStrictness: "NORMAL" | "HIGH" | "BLOCKED";
};

export type StyleTradeApprovalGate = {
  id: string;
  name: string;
  status: StyleApprovalGateStatus;
  score: number;
  threshold: number;
  required: boolean;
  reason: string;
};

export type StylePriorityTradeApprovalDecision = {
  id: string;
  symbol: string;
  primaryStyle: TradingStyle;
  secondaryStyle: TradingStyle;
  activeDirection: Direction;
  approvalStatus: StyleApprovalStatus;
  allowExecution: boolean;
  requireStrictApproval: boolean;
  portfolioBrainRoute: string;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  passedGates: number;
  strictPassedGates: number;
  failedGates: number;
  blockedGates: number;
  gates: StyleTradeApprovalGate[];
  reason: string;
};

export type TradingStylePriorityTradeApprovalSyncReport = {
  version: "V11.9.8";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  approvedSymbols: number;
  strictApprovalSymbols: number;
  rejectedSymbols: number;
  blockedSymbols: number;
  decisions: StylePriorityTradeApprovalDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
