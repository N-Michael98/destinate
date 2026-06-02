import type { StrategyEvolutionScore } from "./evolution-types";

export function rankStrategies(
  strategies: StrategyEvolutionScore[]
) {
  return [...strategies].sort(
    (a, b) => b.evolutionScore - a.evolutionScore
  );
}