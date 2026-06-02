import type { MarketMemoryEntry } from "./memory-types";

const marketMemory: MarketMemoryEntry[] = [];

export function addMarketMemory(
  market: MarketMemoryEntry
) {
  marketMemory.push(market);
}

export function getMarketMemory() {
  return marketMemory;
}

export function clearMarketMemory() {
  marketMemory.length = 0;
}