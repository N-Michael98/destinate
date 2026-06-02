import { calculateConfidence } from "./confidence-engine";
import type { StrategyEvolutionScore } from "./evolution-types";

export function generateMockEvolutionScores(): StrategyEvolutionScore[] {
  const strategies = [
    {
      strategy: "Risk-Off Trend",
      winRate: 74,
      averageReturn: 2.4,
    },
    {
      strategy: "Momentum Breakout",
      winRate: 68,
      averageReturn: 1.8,
    },
    {
      strategy: "Inventory Reaction",
      winRate: 61,
      averageReturn: 1.4,
    },
  ];

  return strategies.map((strategy) => {
    const confidence = calculateConfidence(
      strategy.winRate,
      strategy.averageReturn
    );

    return {
      ...strategy,
      confidence,
      evolutionScore:
        confidence +
        strategy.averageReturn * 5,
    };
  });
}