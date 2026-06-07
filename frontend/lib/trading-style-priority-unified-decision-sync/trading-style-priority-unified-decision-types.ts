export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type UnifiedDecisionMode =
  | "STYLE_APPROVED"
  | "STYLE_STRICT_APPROVAL"
  | "STYLE_WAIT"
  | "STYLE_BLOCKED";

export type TradingStylePriorityInput = {
  symbol: string;
  primaryStyle: TradingStyle | "NONE";
  secondaryStyle: TradingStyle | "NONE";
  activeDirection: Direction;
  activePriorityScore: number;
  activePositionSizeMultiplier: number;
  activeFinalPositionSize: number;
  requiresStrictApproval: boolean;
  tradeAllowed: boolean;
  blockedStyles: TradingStyle[];
  waitingStyles: TradingStyle[];
  rejectedStyles: TradingStyle[];
};

export type StyleUnifiedDecision = {
  id: string;
  symbol: string;
  unifiedDecisionMode: UnifiedDecisionMode;
  primaryStyle: TradingStyle | "NONE";
  secondaryStyle: TradingStyle | "NONE";
  activeDirection: Direction;
  tradeAllowed: boolean;
  executionAllowed: boolean;
  requiresStrictApproval: boolean;
  portfolioBrainRoute: "SCALP_ROUTE" | "DAYTRADE_ROUTE" | "SWING_ROUTE" | "NO_TRADE_ROUTE";
  approvalStrictness: "NORMAL" | "HIGH" | "BLOCKED";
  positionSizeMultiplier: number;
  finalPositionSize: number;
  priorityScore: number;
  blockedStyles: TradingStyle[];
  waitingStyles: TradingStyle[];
  rejectedStyles: TradingStyle[];
  reason: string;
};

export type TradingStylePriorityUnifiedDecisionSyncReport = {
  version: "V11.9.7";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  styleApprovedSymbols: number;
  strictApprovalSymbols: number;
  blockedSymbols: number;
  scalpRouteSymbols: number;
  daytradeRouteSymbols: number;
  swingRouteSymbols: number;
  decisions: StyleUnifiedDecision[];
  integrationTarget: string[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
