export type MarketRegime =
  | "TRENDING"
  | "RANGING"
  | "VOLATILE"
  | "LOW_VOLATILITY"
  | "RISK_ON"
  | "RISK_OFF"
  | "NEWS_DRIVEN";

export type RegimeAnalysis = {
  market: string;
  regime: MarketRegime;
  confidence: number;
  reason: string;
};

export type RegimeResult = {
  primaryRegime: MarketRegime;
  confidence: number;
  preferredStrategy: string;
};