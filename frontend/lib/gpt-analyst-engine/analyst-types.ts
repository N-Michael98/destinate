export type MarketBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export interface TradeIdea {
  symbol: string;

  bias: MarketBias;

  entryLow: number;
  entryHigh: number;

  stopLoss: number;

  takeProfit1: number;
  takeProfit2: number;

  confidence: number;

  reasoning: string;

  createdAt: string;
}