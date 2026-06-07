export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type TradeApprovalStatus =
  | "APPROVED"
  | "STRICT_APPROVAL_REQUIRED"
  | "REJECTED"
  | "WAIT";

export type MultiTimeframeTradeRequest = {
  id: string;
  symbol: string;
  requestedStyle: TradingStyle;
  requestedDirection: Direction;
  requestedPositionSize: number;
};

export type MultiTimeframeUnifiedDecision = {
  symbol: string;
  preferredStyle: TradingStyle | "NONE";
  allowedStyles: TradingStyle[];
  waitingStyles: TradingStyle[];
  blockedStyles: TradingStyle[];
  finalDirection: Direction;
  finalConfidenceScore: number;
  finalRiskScore: number;
  finalPositionSizeMultiplier: number;
  tradeAllowed: boolean;
  requiresStrictApproval: boolean;
  scalpOnlyMode: boolean;
};

export type MultiTimeframeTradeApprovalDecision = {
  id: string;
  symbol: string;
  requestedStyle: TradingStyle;
  requestedDirection: Direction;
  requestedPositionSize: number;
  approvedStyle: TradingStyle | "NONE";
  approvedDirection: Direction;
  approvalStatus: TradeApprovalStatus;
  allowExecution: boolean;
  finalPositionSize: number;
  positionSizeMultiplier: number;
  confidenceScore: number;
  riskScore: number;
  requiresStrictApproval: boolean;
  reason: string;
};

export type MultiTimeframeTradeApprovalSyncReport = {
  version: "V11.9.3";
  status: "READY";
  mode: "SIMULATION";
  totalTradeRequests: number;
  approvedTrades: number;
  strictApprovalTrades: number;
  rejectedTrades: number;
  waitingTrades: number;
  decisions: MultiTimeframeTradeApprovalDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
