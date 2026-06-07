export type Timeframe =
  | "1M"
  | "1W"
  | "1D"
  | "4H"
  | "2H"
  | "1H"
  | "15M"
  | "5M"
  | "1M_ENTRY";

export type TimeframeBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export type TradingStyle =
  | "SCALPING"
  | "DAYTRADING"
  | "SWING";

export type TradingStyleDecisionStatus =
  | "APPROVED"
  | "WAIT"
  | "BLOCKED";

export type TimeframeAnalysisNode = {
  timeframe: Timeframe;
  order: number;
  bias: TimeframeBias;
  trendStrength: number;
  structureScore: number;
  liquidityScore: number;
  momentumScore: number;
  reason: string;
};

export type TradingStyleDecision = {
  style: TradingStyle;
  status: TradingStyleDecisionStatus;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidenceScore: number;
  riskScore: number;
  relevantTimeframes: Timeframe[];
  positionSizeMultiplier: number;
  holdingRule: string;
  entryRule: string;
  reason: string;
};

export type SymbolMultiTimeframeAnalysis = {
  symbol: string;
  topDownBias: TimeframeBias;
  macroBias: TimeframeBias;
  swingBias: TimeframeBias;
  daytradingBias: TimeframeBias;
  scalpingBias: TimeframeBias;
  timeframeNodes: TimeframeAnalysisNode[];
  styleDecisions: TradingStyleDecision[];
  recommendedTradingStyle: TradingStyle | "NONE";
  finalRecommendation: string;
};

export type MultiTimeframeTradingStyleAnalysisReport = {
  version: "V11.9.0";
  status: "READY";
  mode: "SIMULATION";
  analysisOrder: Timeframe[];
  totalSymbols: number;
  approvedScalpingSetups: number;
  approvedDaytradingSetups: number;
  approvedSwingSetups: number;
  blockedSetups: number;
  symbols: SymbolMultiTimeframeAnalysis[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
