import type { TradeMemoryEntry } from "./memory-types";

const tradeMemory: TradeMemoryEntry[] = [];

export function addTradeMemory(
  trade: TradeMemoryEntry
) {
  tradeMemory.push(trade);
}

export function getTradeMemory() {
  return tradeMemory;
}

export function clearTradeMemory() {
  tradeMemory.length = 0;
}