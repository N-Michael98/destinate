export type MarketAssetClass =
  | "FOREX"
  | "COMMODITY"
  | "INDEX"
  | "CRYPTO"
  | "STOCK";

export type MarketUniverseSymbol = {
  id: string;
  symbol: string;
  displayName: string;
  assetClass: MarketAssetClass;
  tradingViewSymbol: string;
  enabled: boolean;
  priority: number;
  strategyFit: string[];
};

export type MarketUniverseReport = {
  version: string;
  status: "READY";
  totalMarkets: number;
  enabledMarkets: number;
  markets: MarketUniverseSymbol[];
  topMarkets: MarketUniverseSymbol[];
  updatedAt: string;
};

const markets: MarketUniverseSymbol[] = [
  {
    id: "xauusd",
    symbol: "XAUUSD",
    displayName: "Gold",
    assetClass: "COMMODITY",
    tradingViewSymbol: "OANDA:XAUUSD",
    enabled: true,
    priority: 95,
    strategyFit: ["TREND", "BREAKOUT", "REVERSAL"],
  },
  {
    id: "usoil",
    symbol: "USOIL",
    displayName: "Oil",
    assetClass: "COMMODITY",
    tradingViewSymbol: "TVC:USOIL",
    enabled: true,
    priority: 90,
    strategyFit: ["TREND", "BREAKOUT", "NEWS"],
  },
  {
    id: "eurusd",
    symbol: "EURUSD",
    displayName: "EURUSD",
    assetClass: "FOREX",
    tradingViewSymbol: "FX:EURUSD",
    enabled: true,
    priority: 88,
    strategyFit: ["TREND", "MEAN_REVERSION", "MACRO"],
  },
  {
    id: "btcusd",
    symbol: "BTCUSD",
    displayName: "BTCUSD",
    assetClass: "CRYPTO",
    tradingViewSymbol: "BINANCE:BTCUSDT",
    enabled: true,
    priority: 85,
    strategyFit: ["TREND", "BREAKOUT", "VOLATILITY"],
  },
  {
    id: "nas100",
    symbol: "NAS100",
    displayName: "Nasdaq 100",
    assetClass: "INDEX",
    tradingViewSymbol: "OANDA:NAS100USD",
    enabled: true,
    priority: 84,
    strategyFit: ["TREND", "BREAKOUT", "RISK_ON"],
  },
  {
    id: "spx500",
    symbol: "SPX500",
    displayName: "S&P 500",
    assetClass: "INDEX",
    tradingViewSymbol: "OANDA:SPX500USD",
    enabled: true,
    priority: 82,
    strategyFit: ["TREND", "RISK_ON", "MACRO"],
  },
  {
    id: "gbpusd",
    symbol: "GBPUSD",
    displayName: "GBPUSD",
    assetClass: "FOREX",
    tradingViewSymbol: "FX:GBPUSD",
    enabled: true,
    priority: 78,
    strategyFit: ["TREND", "MEAN_REVERSION", "MACRO"],
  },
  {
    id: "usdchf",
    symbol: "USDCHF",
    displayName: "USDCHF",
    assetClass: "FOREX",
    tradingViewSymbol: "FX:USDCHF",
    enabled: true,
    priority: 75,
    strategyFit: ["SAFE_HAVEN", "MACRO", "MEAN_REVERSION"],
  },
];

export function getMarketUniverse(): MarketUniverseReport {
  const enabled = markets
    .filter((market) => market.enabled)
    .sort((a, b) => b.priority - a.priority);

  return {
    version: "V11.4.4",
    status: "READY",
    totalMarkets: markets.length,
    enabledMarkets: enabled.length,
    markets,
    topMarkets: enabled.slice(0, 4),
    updatedAt: new Date().toISOString(),
  };
}