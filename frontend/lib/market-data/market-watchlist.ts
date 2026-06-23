export type MarketWatchlistItem = {
  symbol: string;
  displayName: string;
  category: "Indices" | "Forex" | "Commodities" | "Crypto" | "Stocks";
  priority: "HIGH" | "MEDIUM" | "LOW";
  aiFocus: string;
};

export const defaultMarketWatchlist: MarketWatchlistItem[] = [
  // ── Indices ────────────────────────────────────────────────────────────────
  {
    symbol: "NAS100",
    displayName: "Nasdaq 100",
    category: "Indices",
    priority: "HIGH",
    aiFocus: "Momentum, liquidity sweeps, US tech sentiment",
  },
  {
    symbol: "SPX500",
    displayName: "S&P 500",
    category: "Indices",
    priority: "HIGH",
    aiFocus: "Broad US market, risk-on/off, Fed policy",
  },
  {
    symbol: "UK100",
    displayName: "FTSE 100",
    category: "Indices",
    priority: "HIGH",
    aiFocus: "UK macro, GBP correlation, European risk",
  },
  {
    symbol: "GER40",
    displayName: "DAX 40",
    category: "Indices",
    priority: "MEDIUM",
    aiFocus: "European economy, ECB policy, EUR correlation",
  },
  {
    symbol: "DJ30",
    displayName: "Dow Jones 30",
    category: "Indices",
    priority: "MEDIUM",
    aiFocus: "US blue chips, industrial sentiment",
  },
  {
    symbol: "JPN225",
    displayName: "Nikkei 225",
    category: "Indices",
    priority: "LOW",
    aiFocus: "Asian session, JPY correlation, BOJ policy",
  },

  // ── Commodities ────────────────────────────────────────────────────────────
  {
    symbol: "XAUUSD",
    displayName: "Gold",
    category: "Commodities",
    priority: "HIGH",
    aiFocus: "Risk sentiment, USD, yields, macro events",
  },
  {
    symbol: "USOIL",
    displayName: "Crude Oil (WTI)",
    category: "Commodities",
    priority: "HIGH",
    aiFocus: "Supply, demand, inventories, geopolitical risk",
  },
  {
    symbol: "UKOIL",
    displayName: "Brent Oil",
    category: "Commodities",
    priority: "MEDIUM",
    aiFocus: "Global supply, OPEC, geopolitics",
  },
  {
    symbol: "XAGUSD",
    displayName: "Silver",
    category: "Commodities",
    priority: "LOW",
    aiFocus: "Gold correlation, industrial demand",
  },
  {
    symbol: "NATGAS",
    displayName: "Natural Gas",
    category: "Commodities",
    priority: "LOW",
    aiFocus: "Energy sector, seasonal demand",
  },

  // ── Forex ──────────────────────────────────────────────────────────────────
  {
    symbol: "EURUSD",
    displayName: "EUR/USD",
    category: "Forex",
    priority: "HIGH",
    aiFocus: "ECB/Fed policy, dollar strength, macro data",
  },
  {
    symbol: "GBPUSD",
    displayName: "GBP/USD",
    category: "Forex",
    priority: "HIGH",
    aiFocus: "UK macro, USD strength, volatility",
  },
  {
    symbol: "USDJPY",
    displayName: "USD/JPY",
    category: "Forex",
    priority: "MEDIUM",
    aiFocus: "BOJ intervention risk, yield differentials",
  },
  {
    symbol: "USDCHF",
    displayName: "USD/CHF",
    category: "Forex",
    priority: "MEDIUM",
    aiFocus: "Safe haven flows, SNB policy",
  },
  {
    symbol: "AUDUSD",
    displayName: "AUD/USD",
    category: "Forex",
    priority: "MEDIUM",
    aiFocus: "Commodity currency, China sentiment, RBA",
  },
  {
    symbol: "USDCAD",
    displayName: "USD/CAD",
    category: "Forex",
    priority: "MEDIUM",
    aiFocus: "Oil correlation, BOC policy, US-Canada trade",
  },
  {
    symbol: "EURGBP",
    displayName: "EUR/GBP",
    category: "Forex",
    priority: "LOW",
    aiFocus: "ECB vs BOE policy divergence",
  },
  {
    symbol: "GBPJPY",
    displayName: "GBP/JPY",
    category: "Forex",
    priority: "LOW",
    aiFocus: "High volatility cross, risk appetite",
  },
  {
    symbol: "EURJPY",
    displayName: "EUR/JPY",
    category: "Forex",
    priority: "LOW",
    aiFocus: "Risk sentiment, ECB vs BOJ divergence",
  },

  // ── Crypto ─────────────────────────────────────────────────────────────────
  {
    symbol: "BTCUSD",
    displayName: "Bitcoin",
    category: "Crypto",
    priority: "MEDIUM",
    aiFocus: "Crypto sentiment, risk appetite, ETF flows",
  },
  {
    symbol: "ETHUSD",
    displayName: "Ethereum",
    category: "Crypto",
    priority: "LOW",
    aiFocus: "DeFi sentiment, BTC correlation",
  },
];

// Symbole nach Priorität gruppiert
export const HIGH_PRIORITY_SYMBOLS = defaultMarketWatchlist
  .filter(m => m.priority === "HIGH")
  .map(m => m.symbol);

export const ALL_SYMBOLS = defaultMarketWatchlist.map(m => m.symbol);

export const SYMBOLS_BY_CATEGORY = {
  Indices:    defaultMarketWatchlist.filter(m => m.category === "Indices").map(m => m.symbol),
  Commodities: defaultMarketWatchlist.filter(m => m.category === "Commodities").map(m => m.symbol),
  Forex:      defaultMarketWatchlist.filter(m => m.category === "Forex").map(m => m.symbol),
  Crypto:     defaultMarketWatchlist.filter(m => m.category === "Crypto").map(m => m.symbol),
};
