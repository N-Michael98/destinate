import type { MarketSnapshot } from "./market-types";

export type MarketProviderStatus = {
  provider: string;
  status: "PREPARED" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
};

export async function getMarketProviderStatus(): Promise<MarketProviderStatus> {
  return {
    provider: "MockMarketProvider",
    status: "PREPARED",
    message:
      "Market Data Bridge is prepared. Real providers like Capital.com, IC Markets, TradingView and Yahoo Finance will be connected later.",
  };
}

export async function getMockMarketPrices(): Promise<MarketSnapshot[]> {
  const timestamp = new Date().toISOString();

  return [
    {
      symbol: "NAS100",
      displayName: "Nasdaq 100",
      category: "Indices",
      price: 18000,
      changePercent: 0.42,
      source: "MOCK",
      timestamp,
      freshness: "SIMULATED",
    },
    {
      symbol: "XAUUSD",
      displayName: "Gold",
      category: "Commodities",
      price: 2350,
      changePercent: -0.18,
      source: "MOCK",
      timestamp,
      freshness: "SIMULATED",
    },
    {
      symbol: "USOIL",
      displayName: "Crude Oil",
      category: "Commodities",
      price: 78.5,
      changePercent: 0.75,
      source: "MOCK",
      timestamp,
      freshness: "SIMULATED",
    },
    {
      symbol: "EURUSD",
      displayName: "EUR/USD",
      category: "Forex",
      price: 1.085,
      changePercent: 0.12,
      source: "MOCK",
      timestamp,
      freshness: "SIMULATED",
    },
  ];
}