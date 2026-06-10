export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";
export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type MultiStyleConsensusLevel =
  | "NO_CONSENSUS"
  | "LOW_CONFIDENCE"
  | "HIGH_CONFIDENCE"
  | "ELITE_CONFIDENCE";

export type MultiStyleConsensusStatus =
  | "BLOCKED"
  | "WAIT"
  | "TRADE_ALLOWED"
  | "STRICT_APPROVAL_REQUIRED";

export type MultiStyleConsensusStyleVote = {
  symbol: string;
  style: TradingStyle;
  direction: Direction;
  approved: boolean;
  strictApprovalRequired: boolean;
  priorityScore: number;
  confidenceScore: number;
  riskScore: number;
  finalPositionSize: number;
  reason: string;
};

export type MultiStyleConsensusDecision = {
  id: string;
  symbol: string;
  primaryStyle: TradingStyle | "NONE";
  secondaryStyle: TradingStyle | "NONE";
  activeDirection: Direction;
  goCount: number;
  consensusLevel: MultiStyleConsensusLevel;
  consensusScore: number;
  consensusStatus: MultiStyleConsensusStatus;
  approvedStyles: TradingStyle[];
  strictApprovalStyles: TradingStyle[];
  waitingStyles: TradingStyle[];
  rejectedStyles: TradingStyle[];
  blockedStyles: TradingStyle[];
  recommendedPositionMultiplier: number;
  recommendedFinalPositionSize: number;
  votes: MultiStyleConsensusStyleVote[];
  reason: string;
};

export type MultiStyleConsensusReport = {
  version: "V16.1.0";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  tradeAllowedSymbols: number;
  strictApprovalSymbols: number;
  blockedSymbols: number;
  lowConfidenceSymbols: number;
  highConfidenceSymbols: number;
  eliteConfidenceSymbols: number;
  decisions: MultiStyleConsensusDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
