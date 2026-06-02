import { generateMockEvolutionScores } from "./evolution-engine";
import { rankStrategies } from "./strategy-ranker";
import { getMockMarketAdaptations } from "./market-adapter";

export function getEvolutionStatus() {
  return {
    status: "PREPARED",
    message:
      "Strategy Evolution Engine prepared for AI learning and ranking.",
  };
}

export function getStrategyLeaderboard() {
  const scores = generateMockEvolutionScores();

  return rankStrategies(scores);
}

export function getMarketAdaptationStatus() {
  return getMockMarketAdaptations();
}

export function getEvolutionRoadmap() {
  return {
    currentPhase: "Strategy Evolution",

    futureGoals: [
      "Dynamic strategy ranking",
      "Confidence adjustment",
      "Market adaptation",
      "AI memory integration",
      "Autonomous demo agent",
    ],
  };
}