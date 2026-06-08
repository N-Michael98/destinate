import { generateStrategyLifecycleReport }
from "../strategy-lifecycle";

import {
  StrategyEvolutionEntry,
  StrategyEvolutionReport,
  StrategyEvolutionStatus,
} from "./strategy-evolution-types";

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function resolveStatus(
  evolutionScore: number,
  growthRate: number
): StrategyEvolutionStatus {

  if (
    evolutionScore >= 90 &&
    growthRate >= 10
  ) {
    return "BREAKTHROUGH";
  }

  if (
    evolutionScore >= 75
  ) {
    return "EVOLVING";
  }

  if (
    evolutionScore >= 55
  ) {
    return "STABLE";
  }

  return "DECLINING";
}

function buildReason(
  status: StrategyEvolutionStatus,
  evolutionScore: number,
  growthRate: number,
  decayRisk: number
): string {

  return `${status} | Evolution=${evolutionScore} | Growth=${growthRate}% | DecayRisk=${decayRisk}%`;
}

export function generateStrategyEvolutionReport():
  StrategyEvolutionReport {

  const lifecycle =
    generateStrategyLifecycleReport();

  const entries: StrategyEvolutionEntry[] =
    lifecycle.entries.map((entry) => {

      const growthRate =
        round0(
          (entry.decisionConfidence * 0.4) -
          (100 - entry.lifecycleScore) * 0.15
        );

      const decayRisk =
        clamp(
          round0(
            100 -
            entry.lifecycleScore
          ),
          0,
          100
        );

      const evolutionScore =
        clamp(
          round0(
            entry.lifecycleScore * 0.6 +
            entry.competitionScore * 0.3 +
            entry.decisionConfidence * 0.1
          ),
          0,
          100
        );

      const projectedFutureScore =
        clamp(
          round0(
            evolutionScore +
            growthRate -
            decayRisk * 0.15
          ),
          0,
          100
        );

      const evolutionStatus =
        resolveStatus(
          evolutionScore,
          growthRate
        );

      return {
        strategyId: entry.strategyId,
        strategyName: entry.strategyName,
        market: entry.market,
        symbol: entry.symbol,

        lifecycleScore:
          entry.lifecycleScore,

        competitionScore:
          entry.competitionScore,

        confidenceScore:
          entry.decisionConfidence,

        evolutionScore,
        growthRate,
        decayRisk,
        projectedFutureScore,

        evolutionStatus,

        reason:
          buildReason(
            evolutionStatus,
            evolutionScore,
            growthRate,
            decayRisk
          ),
      };
    });

  const sorted =
    [...entries].sort(
      (a, b) =>
        b.evolutionScore -
        a.evolutionScore
    );

  return {
    version: "V13.3.0",
    status: "READY",

    totalStrategies:
      entries.length,

    breakthroughStrategies:
      entries.filter(
        x =>
          x.evolutionStatus ===
          "BREAKTHROUGH"
      ).length,

    evolvingStrategies:
      entries.filter(
        x =>
          x.evolutionStatus ===
          "EVOLVING"
      ).length,

    stableStrategies:
      entries.filter(
        x =>
          x.evolutionStatus ===
          "STABLE"
      ).length,

    decliningStrategies:
      entries.filter(
        x =>
          x.evolutionStatus ===
          "DECLINING"
      ).length,

    strongestEvolution:
      sorted[0]
        ? `${sorted[0].strategyName} (${sorted[0].evolutionScore})`
        : "NONE",

    weakestEvolution:
      sorted.at(-1)
        ? `${sorted.at(-1)?.strategyName} (${sorted.at(-1)?.evolutionScore})`
        : "NONE",

    entries: sorted,

    summary:
      "Strategy Evolution Engine estimates growth, decay risk and future performance trajectory of strategies.",

    createdAt:
      new Date().toISOString(),
  };
}
