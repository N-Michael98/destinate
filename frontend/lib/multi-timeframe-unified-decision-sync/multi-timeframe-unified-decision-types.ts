export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

export type StyleStatus = "APPROVED" | "WAIT" | "BLOCKED";

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type MultiTimeframeStyleInput = {
  symbol: string;
  style: TradingStyle;
  status: StyleStatus;
  direction: Direction;
  confidenceScore: number;
  riskScore: number;
  positionSizeMultiplier: number;
  relevantTimeframes: string[];
  holdingRule: string;
  entryRule: string;
};

export type UnifiedStyleDecision = {
  id: string;
  symbol: string;
  preferredStyle: TradingStyle | "NONE";
  allowedStyles: TradingStyle[];
  blockedStyles: TradingStyle[];
  waitingStyles: TradingStyle[];
  finalDirection: Direction;
  finalConfidenceScore: number;
  finalRiskScore: number;
  finalPositionSizeMultiplier: number;
  executionRule: string;
  tradeAllowed: boolean;
  requiresStrictApproval: boolean;
  scalpOnlyMode: boolean;
  reason: string;
};

export type MultiTimeframeUnifiedDecisionSyncReport = {
  version: "V11.9.2";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  tradeAllowedSymbols: number;
  scalpOnlySymbols: number;
  swingAllowedSymbols: number;
  daytradingAllowedSymbols: number;
  blockedSymbols: number;
  decisions: UnifiedStyleDecision[];
  integrationTarget: string[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
