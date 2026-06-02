export type MarketCategory =
  | "Indices"
  | "Forex"
  | "Commodities"
  | "Crypto"
  | "Stocks";

export type MarketDataSource =
  | "MOCK"
  | "CAPITAL_COM"
  | "IC_MARKETS"
  | "TRADINGVIEW"
  | "YAHOO_FINANCE"
  | "NEWS"
  | "ECONOMIC_CALENDAR";

export type MarketSnapshot = {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  price: number;
  bid?: number;
  ask?: number;
  changePercent: number;
  source: MarketDataSource;
  timestamp: string;
  freshness: "FRESH" | "STALE" | "SIMULATED";
};