import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { AITradeOutcomeTracker } from "./trade-outcome-tracker";
import { StrategyLibrary } from "./strategy-library";
import { MarketRegimeEngine } from "./market-regime-engine";

type StrategyProfile = {
  id: string;
  name: string;
  type: string;
  category: string;
  status: "ACTIVE" | "WATCH" | "REVIEW" | "RESEARCH" | "DISABLED";
  source: string;
  baseScore: number;
  score: number;
  confidenceBoost: number;
  riskLevel: string;
  complexity: string;
  markets: string[];
  timeframes: string[];
  regimeFit: string;
  reason: string;
};

const regimeCategoryPreference: Record<string, string[]> = {
  TRENDING: ["MOMENTUM", "TREND", "MARKET_STRUCTURE", "EMA"],
  RANGING: ["MEAN_REVERSION", "VWAP", "RSI", "SUPPLY_DEMAND"],
  VOLATILE: ["BREAKOUT", "LIQUIDITY", "SCALPING", "MARKET_STRUCTURE"],
  NEWS: ["NEWS_REACTION", "SUPPLY_DEMAND", "LIQUIDITY"],
};

export class StrategyEvolutionEngine {
  static analyze() {
    const memoryStats = AgentMemory.getStats();
    const learning = AILearningEngine.analyze();
    const outcomes = AITradeOutcomeTracker.analyze();
    const marketRegime = MarketRegimeEngine.analyze();

    const strategyUniverse = StrategyLibrary.getAll();

    const selectableStrategies = strategyUniverse.filter(
      (strategy) =>
        strategy.status === "ACTIVE" ||
        strategy.status === "WATCH" ||
        strategy.status === "RESEARCH"
    );

    const preferredCategories =
      regimeCategoryPreference[marketRegime.regime] ?? [];

    const memoryStrength = Math.min(
      100,
      memoryStats.totalMemories * 10
    );

    const outcomeStrength =
      outcomes.closedTrades > 0
        ? outcomes.winRate
        : 50;

    const learningStrength = learning.learningScore;

    const adaptiveFactor = Math.round(
      memoryStrength * 0.2 +
        outcomeStrength * 0.4 +
        learningStrength * 0.4
    );

    const statusBoost: Record<string, number> = {
      ACTIVE: 6,
      WATCH: 3,
      RESEARCH: -4,
      REVIEW: -8,
      DISABLED: -100,
    };

    const riskPenalty: Record<string, number> = {
      LOW: 2,
      MEDIUM: 0,
      HIGH: -4,
    };

    const complexityPenalty: Record<string, number> = {
      BASIC: 2,
      INTERMEDIATE: 0,
      ADVANCED: -2,
    };

    const strategies: StrategyProfile[] = selectableStrategies.map(
      (strategy) => {
        const regimeMatch =
          preferredCategories.includes(strategy.category);

        const regimeBoost = regimeMatch ? 12 : -6;

        const adaptiveScore =
          strategy.baseScore +
          adaptiveFactor * 0.1 +
          (statusBoost[strategy.status] ?? 0) +
          (riskPenalty[strategy.riskLevel] ?? 0) +
          (complexityPenalty[strategy.complexity] ?? 0) +
          regimeBoost;

        const score = Math.min(
          100,
          Math.max(0, Math.round(adaptiveScore))
        );

        const shouldReview =
          score < 60 ||
          learning.rejectionRate > 40;

        return {
          id: strategy.id,
          name: strategy.name,
          type: strategy.category,
          category: strategy.category,
          status: shouldReview
            ? "REVIEW"
            : strategy.status,
          source: strategy.source,
          baseScore: strategy.baseScore,
          score,
          confidenceBoost:
            score >= 85
              ? Math.max(strategy.confidenceBoost, 3)
              : score >= 75
                ? strategy.confidenceBoost
                : 0,
          riskLevel: strategy.riskLevel,
          complexity: strategy.complexity,
          markets: strategy.markets,
          timeframes: strategy.timeframes,
          regimeFit: regimeMatch
            ? `MATCH_${marketRegime.regime}`
            : `NO_MATCH_${marketRegime.regime}`,
          reason: regimeMatch
            ? `${strategy.name} fits current ${marketRegime.regime} regime and scored ${score} using memory, learning, outcomes, risk and complexity filters.`
            : `${strategy.name} does not directly fit current ${marketRegime.regime} regime and received a regime penalty. Final score ${score}.`,
        };
      }
    );

    const rankedStrategies = strategies.sort(
      (a, b) => b.score - a.score
    );

    const regimeMatchedStrategies =
      rankedStrategies.filter((strategy) =>
        strategy.regimeFit.startsWith("MATCH")
      );

    const bestStrategy =
      regimeMatchedStrategies[0] ?? rankedStrategies[0];

    const recommendation =
      bestStrategy.score >= 85
        ? `Prioritize ${bestStrategy.name}. It is currently the strongest strategy for ${marketRegime.regime} market regime.`
        : bestStrategy.score >= 75
          ? `Use ${bestStrategy.name} as preferred paper strategy for ${marketRegime.regime}, but continue testing.`
          : `No strong strategy for ${marketRegime.regime} yet. Continue paper testing and reduce risk.`;

    return {
      version: "V10.5.2",
      totalStrategies: strategyUniverse.length,
      selectableStrategies: selectableStrategies.length,
      marketRegime,
      preferredCategories,
      memory: memoryStats,
      learning,
      outcomes,
      adaptiveFactor,
      bestStrategy,
      strategies: rankedStrategies,
      regimeMatchedStrategies,
      recommendation,
      status: "analyzed",
      updatedAt: new Date().toISOString(),
    };
  }
}