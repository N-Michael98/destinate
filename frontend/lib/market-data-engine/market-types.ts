export type FeedSource =
  | "TRADINGVIEW"
  | "CAPITAL_COM"
  | "IC_MARKETS";

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: string;
  source: FeedSource;
}

export interface MarketFeedStatus {
  source: FeedSource;
  connected: boolean;
  latencyMs: number;
  updatedAt: string;
}