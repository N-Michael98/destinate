export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type StyleStatus =
  | "APPROVED"
  | "STRICT_APPROVAL_REQUIRED"
  | "WAIT"
  | "REJECTED";

export type StylePriorityInput = {
  symbol: string;
  style: TradingStyle;
  direction: Direction;
  status: StyleStatus;
  confidenceScore: number;
  riskScore: number;
  requestedPositionSize: number;
  finalPositionSize: number;
  positionSizeMultiplier: number;
  requiresStrictApproval: boolean;
};

export type StylePriorityDecision = {
  symbol: string;
  style: TradingStyle;
  direction: Direction;
  status: StyleStatus;
  confidenceScore: number;
  riskScore: number;
  priorityScore: number;
  rank: number;
  isPrimary: boolean;
  isSecondary: boolean;
  isBlocked: boolean;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  reason: string;
};

export type SymbolStylePriorityResult = {
  id: string;
  symbol: string;
  primaryStyle: TradingStyle | "NONE";
  secondaryStyle: TradingStyle | "NONE";
  blockedStyles: TradingStyle[];
  waitingStyles: TradingStyle[];
  rejectedStyles: TradingStyle[];
  activeDirection: Direction;
  activePriorityScore: number;
  activePositionSizeMultiplier: number;
  activeFinalPositionSize: number;
  requiresStrictApproval: boolean;
  tradeAllowed: boolean;
  decisions: StylePriorityDecision[];
  recommendation: string;
};

export type TradingStylePriorityEngineReport = {
  version: "V11.9.5";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  symbolsWithPrimaryStyle: number;
  scalpPrimarySymbols: number;
  daytradingPrimarySymbols: number;
  swingPrimarySymbols: number;
  blockedSymbols: number;
  results: SymbolStylePriorityResult[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
