import type { MarketSnapshot } from "./market-types";

const marketCache = new Map<string, MarketSnapshot>();

export function setMarketCache(snapshot: MarketSnapshot) {
  marketCache.set(snapshot.symbol, snapshot);
}

export function getMarketFromCache(symbol: string) {
  return marketCache.get(symbol) ?? null;
}

export function getAllCachedMarkets() {
  return Array.from(marketCache.values());
}

export function clearMarketCache() {
  marketCache.clear();
}

export function getMarketCacheStatus() {
  return {
    status: "READY" as const,
    cachedSymbols: marketCache.size,
    message:
      "In-memory market cache prepared for V7.5. Persistent cache/database can be added later.",
  };
}