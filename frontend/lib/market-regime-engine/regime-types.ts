export type TrendRegime =
  | "STRONG_BULL"
  | "TRENDING_BULL"
  | "WEAK_BULL"
  | "RANGING"
  | "WEAK_BEAR"
  | "TRENDING_BEAR"
  | "STRONG_BEAR";

export type VolatilityRegime =
  | "LOW_VOLATILITY"
  | "NORMAL"
  | "ELEVATED"
  | "VOLATILE"
  | "EXTREME_VOLATILITY";

export type RiskRegime =
  | "RISK_ON"
  | "RISK_OFF"
  | "NEUTRAL"
  | "SAFE_HAVEN"
  | "SPECULATIVE";

export type PrimaryMarketRegime =
  | "BULLISH_TREND"
  | "BEARISH_TREND"
  | "RANGING"
  | "BREAKOUT"
  | "REVERSAL_RISK"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY";

export type RegimeType =
  | "TRENDING_BULL"
  | "TRENDING_BEAR"
  | "RANGING"
  | "BREAKOUT"
  | "VOLATILE"
  | "RISK_ON"
  | "RISK_OFF";

export interface MarketRegime {
  symbol: string;
  price: number;
  previousPrice: number | null;
  spread: number;
  priceChange: number;
  priceChangePercent: number;
  trend: TrendRegime;
  volatility: VolatilityRegime;
  risk: RiskRegime;
  primaryRegime: PrimaryMarketRegime;
  trendScore: number;
  volatilityScore: number;
  riskScore: number;
  confidence: number;
  preferredStrategyBias: string;
  reason: string;
  updatedAt: string;
}
