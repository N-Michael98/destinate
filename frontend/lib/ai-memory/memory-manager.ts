import { getTradeMemory } from "./trade-memory";
import { getStrategyMemory } from "./strategy-memory";
import { getMarketMemory } from "./market-memory";

export function getMemoryStatus() {
  return {
    status: "ACTIVE",
    tradeMemoryCount: getTradeMemory().length,
    strategyMemoryCount: getStrategyMemory().length,
    marketMemoryCount: getMarketMemory().length,
  };
}

export function getLearningRoadmap() {
  return {
    currentPhase: "AI Learning Memory",

    futureGoals: [
      "Store trade results",
      "Store market behaviour",
      "Store strategy performance",
      "Improve confidence scoring",
      "Enable strategy evolution",
    ],
  };
}