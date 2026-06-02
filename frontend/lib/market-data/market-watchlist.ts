export type MarketWatchlistItem = {
  symbol: string;
  displayName: string;
  category: "Indices" | "Forex" | "Commodities" | "Crypto" | "Stocks";
  priority: "HIGH" | "MEDIUM" | "LOW";
  aiFocus: string;
};

export const defaultMarketWatchlist: MarketWatchlistItem[] = [
  {
    symbol: "NAS100",
    displayName: "Nasdaq 100",
    category: "Indices",
    priority: "HIGH",
    aiFocus: "Momentum, liquidity sweeps, US tech sentiment",
  },
  {
    symbol: "XAUUSD",
    displayName: "Gold",
    category: "Commodities",
    priority: "HIGH",
    aiFocus: "Risk sentiment, USD, yields, macro events",
  },
  {
    symbol: "USOIL",
    displayName: "Crude Oil",
    category: "Commodities",
    priority: "HIGH",
    aiFocus: "Supply, demand, inventories, geopolitical risk",
  },
  {
    symbol: "EURUSD",
    displayName: "EUR/USD",
    category: "Forex",
    priority: "MEDIUM",
    aiFocus: "ECB/Fed policy, dollar strength, macro data",
  },
  {
    symbol: "GBPUSD",
    displayName: "GBP/USD",
    category: "Forex",
    priority: "MEDIUM",
    aiFocus: "UK macro, USD strength, volatility",
  },
  {
    symbol: "BTCUSD",
    displayName: "Bitcoin",
    category: "Crypto",
    priority: "LOW",
    aiFocus: "Crypto sentiment and risk appetite",
  },
];