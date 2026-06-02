import type { StrategyMemoryEntry } from "./memory-types";

const strategyMemory: StrategyMemoryEntry[] = [];

export function addStrategyMemory(
  strategy: StrategyMemoryEntry
) {
  strategyMemory.push(strategy);
}

export function getStrategyMemory() {
  return strategyMemory;
}

export function clearStrategyMemory() {
  strategyMemory.length = 0;
}