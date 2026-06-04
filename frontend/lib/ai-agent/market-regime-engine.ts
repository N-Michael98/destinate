import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { AITradeOutcomeTracker } from "./trade-outcome-tracker";

export type MarketRegime =
  | "TRENDING"
  | "RANGING"
  | "VOLATILE"
  | "NEWS";

export class MarketRegimeEngine {
  static analyze() {
    const memory =
      AgentMemory.getStats();

    const learning =
      AILearningEngine.analyze();

    const outcomes =
      AITradeOutcomeTracker.analyze();

    const confidence =
      memory.averageConfidence ?? 70;

    const learningScore =
      learning.learningScore ?? 50;

    const winRate =
      outcomes.winRate ?? 50;

    let regime: MarketRegime =
      "RANGING";

    let score = 50;

    if (
      confidence > 85 &&
      learningScore > 80
    ) {
      regime = "TRENDING";
      score = 85;
    }

    if (
      confidence > 90 &&
      learningScore > 85 &&
      winRate > 60
    ) {
      regime = "VOLATILE";
      score = 92;
    }

    if (
      learning.rejectionRate > 30
    ) {
      regime = "NEWS";
      score = 70;
    }

    let recommendation =
      "Use balanced strategy selection.";

    switch (regime) {
      case "TRENDING":
        recommendation =
          "Favor Trend and Momentum strategies.";
        break;

      case "RANGING":
        recommendation =
          "Favor Mean Reversion strategies.";
        break;

      case "VOLATILE":
        recommendation =
          "Favor Breakout strategies.";
        break;

      case "NEWS":
        recommendation =
          "Reduce risk and wait for confirmation.";
        break;
    }

    return {
      version: "V10.5.0",
      regime,
      score,
      recommendation,

      memoryConfidence:
        confidence,

      learningScore,

      winRate,

      totalMemories:
        memory.totalMemories,

      updatedAt:
        new Date().toISOString(),
    };
  }
}