import { buildPortfolioBrainAdaptiveConfidenceReport } from "./portfolio-brain-adaptive-confidence";
import { buildPortfolioBrainOutcomeLearningSyncReport } from "./portfolio-brain-outcome-learning-sync";

export type PortfolioBrainSelfEvolutionStrategy = {
  strategy: string;
  symbols: string[];
  totalSignals: number;
  wins: number;
  losses: number;
  breakevens: number;
  noTrades: number;
  winRate: number;
  averagePnlPercent: number;
  averageAdaptiveConfidence: number;
  totalConfidenceAdjustment: number;
  evolutionScore: number;
  weight: number;
  state: "PROMOTE" | "KEEP" | "REDUCE" | "OBSERVE";
  reason: string;
};

export type PortfolioBrainSelfEvolutionReport = {
  version: string;
  status: "READY";
  totalStrategies: number;
  promotedStrategies: number;
  reducedStrategies: number;
  observedStrategies: number;
  bestStrategy: PortfolioBrainSelfEvolutionStrategy | null;
  weakestStrategy: PortfolioBrainSelfEvolutionStrategy | null;
  strategies: PortfolioBrainSelfEvolutionStrategy[];
  recommendation: string;
  updatedAt: string;
};

function calculateState(input: {
  winRate: number;
  evolutionScore: number;
  totalSignals: number;
}): "PROMOTE" | "KEEP" | "REDUCE" | "OBSERVE" {
  if (input.totalSignals === 0) return "OBSERVE";
  if (input.evolutionScore >= 70 && input.winRate >= 60) return "PROMOTE";
  if (input.evolutionScore < 45) return "REDUCE";
  return "KEEP";
}

function calculateWeight(input: {
  evolutionScore: number;
  winRate: number;
  averageAdaptiveConfidence: number;
}): number {
  const raw =
    input.evolutionScore * 0.5 +
    input.winRate * 0.25 +
    input.averageAdaptiveConfidence * 0.25;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function buildPortfolioBrainSelfEvolutionReport(): PortfolioBrainSelfEvolutionReport {
  const adaptiveConfidence = buildPortfolioBrainAdaptiveConfidenceReport();
  const outcomeLearning = buildPortfolioBrainOutcomeLearningSyncReport();

  const grouped = new Map<
    string,
    {
      strategy: string;
      symbols: Set<string>;
      totalSignals: number;
      wins: number;
      losses: number;
      breakevens: number;
      noTrades: number;
      pnlTotal: number;
      pnlCount: number;
      adaptiveConfidenceTotal: number;
      adaptiveConfidenceCount: number;
      confidenceAdjustmentTotal: number;
    }
  >();

  for (const item of adaptiveConfidence.items) {
    const current =
      grouped.get(item.strategy) ??
      {
        strategy: item.strategy,
        symbols: new Set<string>(),
        totalSignals: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        noTrades: 0,
        pnlTotal: 0,
        pnlCount: 0,
        adaptiveConfidenceTotal: 0,
        adaptiveConfidenceCount: 0,
        confidenceAdjustmentTotal: 0,
      };

    current.symbols.add(item.symbol);
    current.totalSignals += 1;
    current.adaptiveConfidenceTotal += item.adaptiveConfidence;
    current.adaptiveConfidenceCount += 1;
    current.confidenceAdjustmentTotal += item.confidenceAdjustment;

    const learningItem = outcomeLearning.items.find(
      (learning) => learning.symbol === item.symbol
    );

    if (learningItem) {
      if (learningItem.simulatedOutcome === "WIN") current.wins += 1;
      if (learningItem.simulatedOutcome === "LOSS") current.losses += 1;
      if (learningItem.simulatedOutcome === "BREAKEVEN") current.breakevens += 1;
      if (learningItem.simulatedOutcome === "NO_TRADE") current.noTrades += 1;

      if (learningItem.simulatedOutcome !== "NO_TRADE") {
        current.pnlTotal += learningItem.simulatedPnlPercent;
        current.pnlCount += 1;
      }
    }

    grouped.set(item.strategy, current);
  }

  const strategies = Array.from(grouped.values())
    .map((group) => {
      const closedSignals = group.wins + group.losses + group.breakevens;

      const winRate =
        closedSignals === 0 ? 0 : Math.round((group.wins / closedSignals) * 100);

      const averagePnlPercent =
        group.pnlCount === 0
          ? 0
          : Number((group.pnlTotal / group.pnlCount).toFixed(2));

      const averageAdaptiveConfidence =
        group.adaptiveConfidenceCount === 0
          ? 0
          : Math.round(
              group.adaptiveConfidenceTotal / group.adaptiveConfidenceCount
            );

      const baseEvolutionScore =
        winRate * 0.35 +
        averagePnlPercent * 10 +
        averageAdaptiveConfidence * 0.35 +
        group.confidenceAdjustmentTotal * 2;

      const evolutionScore = Math.max(
        0,
        Math.min(100, Math.round(baseEvolutionScore))
      );

      const weight = calculateWeight({
        evolutionScore,
        winRate,
        averageAdaptiveConfidence,
      });

      const state = calculateState({
        winRate,
        evolutionScore,
        totalSignals: group.totalSignals,
      });

      return {
        strategy: group.strategy,
        symbols: Array.from(group.symbols),
        totalSignals: group.totalSignals,
        wins: group.wins,
        losses: group.losses,
        breakevens: group.breakevens,
        noTrades: group.noTrades,
        winRate,
        averagePnlPercent,
        averageAdaptiveConfidence,
        totalConfidenceAdjustment: group.confidenceAdjustmentTotal,
        evolutionScore,
        weight,
        state,
        reason: `${group.strategy} has ${winRate}% win rate, ${averagePnlPercent}% average PnL, ${averageAdaptiveConfidence}% adaptive confidence and evolution score ${evolutionScore}.`,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  const promotedStrategies = strategies.filter(
    (strategy) => strategy.state === "PROMOTE"
  ).length;

  const reducedStrategies = strategies.filter(
    (strategy) => strategy.state === "REDUCE"
  ).length;

  const observedStrategies = strategies.filter(
    (strategy) => strategy.state === "OBSERVE"
  ).length;

  const bestStrategy = strategies[0] ?? null;
  const weakestStrategy =
    strategies.length === 0 ? null : strategies[strategies.length - 1];

  const recommendation =
    bestStrategy === null
      ? "No self-evolution strategy data available yet."
      : `${bestStrategy.strategy} is currently the strongest self-evolving strategy with weight ${bestStrategy.weight}.`;

  return {
    version: "V11.6.0",
    status: "READY",
    totalStrategies: strategies.length,
    promotedStrategies,
    reducedStrategies,
    observedStrategies,
    bestStrategy,
    weakestStrategy,
    strategies,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}