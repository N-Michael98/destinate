import { generateStrategyRankingReport } from "@/lib/strategy-ranking";
import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";
import { buildAutonomousTradingEvolutionMemoryReport } from "@/lib/autonomous-trading-evolution-memory";

import {
  AutonomousEvolutionStrategyWeightDecision,
  AutonomousEvolutionStrategyWeightSyncReport,
} from "./autonomous-evolution-strategy-weight-sync-types";

const VERSION = "V16.0.6" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function resolveBaseWeight(rank: number) {
  if (rank === 1) return 20;
  if (rank <= 3) return 16;
  if (rank <= 8) return 10;
  if (rank <= 20) return 6;
  return 3;
}

function resolveStatus(params: {
  finalStrategyScore: number;
  evolutionScore: number;
  memoryScore: number;
  cycleDecision: string;
  rank: number;
}): AutonomousEvolutionStrategyWeightDecision["status"] {
  if (params.cycleDecision === "PAUSE_EVOLUTION") return "BLOCK";
  if (params.finalStrategyScore < 55) return "BLOCK";

  if (params.cycleDecision === "REDUCE_RISK") {
    return params.rank <= 5 ? "HOLD" : "REDUCE";
  }

  if (
    params.finalStrategyScore >= 72 &&
    params.evolutionScore >= 70 &&
    params.memoryScore >= 60 &&
    params.rank <= 8
  ) {
    return "BOOST";
  }

  if (params.finalStrategyScore < 65) return "REDUCE";

  return "HOLD";
}

function calculateRecommendedWeight(params: {
  baseWeight: number;
  status: AutonomousEvolutionStrategyWeightDecision["status"];
  finalStrategyScore: number;
  evolutionScore: number;
  memoryScore: number;
}) {
  const qualityBoost =
    (params.finalStrategyScore - 65) * 0.08 +
    (params.evolutionScore - 60) * 0.05 +
    (params.memoryScore - 50) * 0.03;

  if (params.status === "BOOST") {
    return clamp(params.baseWeight + qualityBoost + 4, 3, 28);
  }

  if (params.status === "REDUCE") {
    return clamp(params.baseWeight - 4, 1, 12);
  }

  if (params.status === "BLOCK") {
    return 0;
  }

  return clamp(params.baseWeight + Math.min(2, Math.max(0, qualityBoost)), 2, 20);
}

function buildReason(params: {
  strategy: string;
  status: AutonomousEvolutionStrategyWeightDecision["status"];
  cycleDecision: string;
  evolutionScore: number;
  memoryScore: number;
}) {
  if (params.status === "BOOST") {
    return `${params.strategy} receives a controlled weight boost because autonomous evolution and memory scores are strong.`;
  }

  if (params.status === "REDUCE") {
    return `${params.strategy} weight is reduced because score or cycle conditions require more caution.`;
  }

  if (params.status === "BLOCK") {
    return `${params.strategy} is blocked from allocation because autonomous evolution is paused or ranking quality is too weak.`;
  }

  return `${params.strategy} remains on hold with stable allocation under ${params.cycleDecision}. Evolution score ${params.evolutionScore}, memory score ${params.memoryScore}.`;
}

export function generateAutonomousEvolutionStrategyWeightSyncReport():
  AutonomousEvolutionStrategyWeightSyncReport {
  const ranking = generateStrategyRankingReport();
  const evolution = generateAutonomousTradingEvolutionReport();
  const memory = buildAutonomousTradingEvolutionMemoryReport();

  const memoryScore = memory.stats.averageEvolutionScore || evolution.autonomousEvolutionScore;

  const decisions: AutonomousEvolutionStrategyWeightDecision[] =
    ranking.rankingProfiles.slice(0, 25).map((profile) => {
      const baseWeight = resolveBaseWeight(profile.rank);
      const status = resolveStatus({
        finalStrategyScore: profile.finalStrategyScore,
        evolutionScore: evolution.autonomousEvolutionScore,
        memoryScore,
        cycleDecision: evolution.cycleDecision,
        rank: profile.rank,
      });

      const recommendedWeight = round(
        calculateRecommendedWeight({
          baseWeight,
          status,
          finalStrategyScore: profile.finalStrategyScore,
          evolutionScore: evolution.autonomousEvolutionScore,
          memoryScore,
        })
      );

      return {
        id: `autonomous-weight-${profile.strategyId}-${profile.symbol}-${profile.tradingStyle}`,
        strategy: profile.strategyName,
        symbol: profile.symbol,
        rank: profile.rank,
        baseScore: profile.finalStrategyScore,
        evolutionScore: evolution.autonomousEvolutionScore,
        memoryScore,
        baseWeight,
        recommendedWeight,
        weightChange: round(recommendedWeight - baseWeight),
        status,
        reason: buildReason({
          strategy: profile.strategyName,
          status,
          cycleDecision: evolution.cycleDecision,
          evolutionScore: evolution.autonomousEvolutionScore,
          memoryScore,
        }),
      };
    });

  const boostedStrategies = decisions.filter((item) => item.status === "BOOST").length;
  const reducedStrategies = decisions.filter((item) => item.status === "REDUCE").length;
  const heldStrategies = decisions.filter((item) => item.status === "HOLD").length;
  const blockedStrategies = decisions.filter((item) => item.status === "BLOCK").length;

  const totalBaseWeight = round(
    decisions.reduce((sum, item) => sum + item.baseWeight, 0)
  );

  const totalRecommendedWeight = round(
    decisions.reduce((sum, item) => sum + item.recommendedWeight, 0)
  );

  const recommendation =
    evolution.cycleDecision === "CONTINUE_EVOLUTION"
      ? `Autonomous Evolution supports controlled strategy weight adaptation toward ${evolution.topStrategy}.`
      : evolution.cycleDecision === "REDUCE_RISK"
        ? "Autonomous Evolution recommends reduced risk. Strategy weights should stay defensive."
        : "Autonomous Evolution is paused. Strategy allocation expansion is blocked.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    cycleDecision: evolution.cycleDecision,
    topStrategy: evolution.topStrategy,
    championSpecies: evolution.championSpecies,
    autonomousEvolutionScore: evolution.autonomousEvolutionScore,
    averageMemoryScore: memoryScore,
    totalStrategies: decisions.length,
    boostedStrategies,
    reducedStrategies,
    heldStrategies,
    blockedStrategies,
    totalBaseWeight,
    totalRecommendedWeight,
    decisions,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
