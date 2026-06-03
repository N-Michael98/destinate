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
  regime: RegimeType;
  confidence: number;
  updatedAt: string;
}