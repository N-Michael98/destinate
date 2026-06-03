import { MarketFeedStatus } from "./market-types";

export class MarketHealth {
  getStatus(): MarketFeedStatus[] {
    return [
      {
        source: "TRADINGVIEW",
        connected: true,
        latencyMs: 20,
        updatedAt: new Date().toISOString(),
      },
      {
        source: "CAPITAL_COM",
        connected: false,
        latencyMs: 0,
        updatedAt: new Date().toISOString(),
      },
      {
        source: "IC_MARKETS",
        connected: false,
        latencyMs: 0,
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export const marketHealth = new MarketHealth();