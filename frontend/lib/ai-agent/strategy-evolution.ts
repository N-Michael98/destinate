import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { AITradeOutcomeTracker } from "./trade-outcome-tracker";

type StrategyProfile = {
  id: string;
  name: string;
  type: "MOMENTUM" | "BREAKOUT" | "TREND" | "MEAN_REVERSION";
  status: "ACTIVE" | "WATCH" | "REVIEW";
  baseScore: number;
  score: number;
  confidenceBoost: number;
  reason: string;
};

export class StrategyEvolutionEngine {
  static analyze() {
    const memoryStats = AgentMemory.getStats();
    const learning = AILearningEngine.analyze();
    const outcomes = AITradeOutcomeTracker.analyze();

    const memoryStrength = Math.min(
      100,
      memoryStats.totalMemories * 10
    );

    const outcomeStrength =
      outcomes.closedTrades > 0
        ? outcomes.winRate
        : 50;

    const learningStrength =
      learning.learningScore;

    const adaptiveFactor = Math.round(
      memoryStrength * 0.2 +
        outcomeStrength * 0.4 +
        learningStrength * 0.4
    );

    const strategies: StrategyProfile[] = [
      {
        id: "strategy-momentum-v1",
        name: "Momentum Continuation",
        type: "MOMENTUM",
        status: "ACTIVE",
        baseScore: 78,
        score: Math.min(
          100,
          Math.round(78 + adaptiveFactor * 0.12)
        ),
        confidenceBoost: 3,
        reason:
          "Momentum remains the primary mock strategy for EURUSD AI paper trades.",
      },
      {
        id: "strategy-breakout-v1",
        name: "Breakout Expansion",
        type: "BREAKOUT",
        status: "WATCH",
        baseScore: 72,
        score: Math.min(
          100,
          Math.round(72 + adaptiveFactor * 0.08)
        ),
        confidenceBoost: 1,
        reason:
          "Breakout logic is prepared but needs more outcome data before priority increase.",
      },
      {
        id: "strategy-trend-v1",
        name: "Trend Following",
        type: "TREND",
        status: "WATCH",
        baseScore: 74,
        score: Math.min(
          100,
          Math.round(74 + adaptiveFactor * 0.1)
        ),
        confidenceBoost: 2,
        reason:
          "Trend following benefits from stable consensus and improving learning score.",
      },
      {
        id: "strategy-mean-reversion-v1",
        name: "Mean Reversion",
        type: "MEAN_REVERSION",
        status:
          learning.rejectionRate > 30
            ? "REVIEW"
            : "WATCH",
        baseScore: 64,
        score: Math.min(
          100,
          Math.round(64 + adaptiveFactor * 0.05)
        ),
        confidenceBoost: 0,
        reason:
          "Mean reversion is lower priority until market regime and outcome history improve.",
      },
    ];

    const rankedStrategies =
      strategies.sort((a, b) => b.score - a.score);

    const bestStrategy =
      rankedStrategies[0];

    const recommendation =
      bestStrategy.score >= 85
        ? `Prioritize ${bestStrategy.name}. Strategy confidence is strong.`
        : bestStrategy.score >= 75
          ? `Use ${bestStrategy.name} as preferred strategy, but keep collecting outcome data.`
          : "No strategy has strong evidence yet. Continue paper testing and keep risk small.";

    return {
      version: "V10.4.0",
      memory: memoryStats,
      learning,
      outcomes,
      adaptiveFactor,
      bestStrategy,
      strategies: rankedStrategies,
      recommendation,
      status: "analyzed",
      updatedAt: new Date().toISOString(),
    };
  }
}