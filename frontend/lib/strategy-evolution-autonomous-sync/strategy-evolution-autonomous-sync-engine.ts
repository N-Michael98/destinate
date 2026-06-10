import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";
import { generateEvolutionFeedbackStrategyEvolutionSyncReport } from "@/lib/evolution-feedback-strategy-evolution-sync";

import {
  AutonomousFeedbackCycleDecision,
  StrategyEvolutionAutonomousSyncReport,
} from "./strategy-evolution-autonomous-sync-types";

const VERSION = "V16.2.6" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveCycleDecision(score: number): AutonomousFeedbackCycleDecision {
  if (score >= 70) return "CONTINUE_EVOLUTION";
  if (score >= 50) return "REDUCE_RISK";
  return "PAUSE_EVOLUTION";
}

function resolveMutationPressureMode(params: {
  underReviewStrategies: number;
  decliningStrategies: number;
  breakthroughStrategies: number;
}) {
  if (params.underReviewStrategies > 0) return "EXTREME" as const;
  if (params.decliningStrategies >= 3) return "HIGH" as const;
  if (params.breakthroughStrategies > 0) return "LOW" as const;
  return "NORMAL" as const;
}

function resolveAutonomousRiskBias(params: {
  adjustedScore: number;
  mutationPressureMode: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
}) {
  if (
    params.adjustedScore < 50 ||
    params.mutationPressureMode === "EXTREME"
  ) {
    return "PAUSE" as const;
  }

  if (
    params.adjustedScore < 70 ||
    params.mutationPressureMode === "HIGH"
  ) {
    return "DEFENSIVE" as const;
  }

  if (
    params.adjustedScore >= 80 &&
    params.mutationPressureMode === "LOW"
  ) {
    return "EXPAND" as const;
  }

  return "NORMAL" as const;
}

function calculateFeedbackBoost(params: {
  feedbackAdjustedAverageScore: number;
  breakthroughStrategies: number;
  evolvingStrategies: number;
  decliningStrategies: number;
  underReviewStrategies: number;
}) {
  return clamp(
    Math.round(
      (params.feedbackAdjustedAverageScore - 70) * 0.25 +
        params.breakthroughStrategies * 3 +
        params.evolvingStrategies * 0.6 -
        params.decliningStrategies * 2 -
        params.underReviewStrategies * 5
    ),
    -25,
    25
  );
}

function buildRecommendation(params: {
  adjustedCycleDecision: AutonomousFeedbackCycleDecision;
  autonomousRiskBias: "EXPAND" | "NORMAL" | "DEFENSIVE" | "PAUSE";
}) {
  if (
    params.adjustedCycleDecision === "CONTINUE_EVOLUTION" &&
    params.autonomousRiskBias === "EXPAND"
  ) {
    return "Feedback-adjusted autonomous evolution supports controlled expansion.";
  }

  if (params.adjustedCycleDecision === "CONTINUE_EVOLUTION") {
    return "Feedback-adjusted autonomous evolution can continue under normal controls.";
  }

  if (params.adjustedCycleDecision === "REDUCE_RISK") {
    return "Feedback-adjusted autonomous evolution should continue defensively with reduced risk.";
  }

  return "Feedback-adjusted autonomous evolution should pause and review strategy quality.";
}

export function generateStrategyEvolutionAutonomousSyncReport():
  StrategyEvolutionAutonomousSyncReport {
  const autonomous = generateAutonomousTradingEvolutionReport();
  const feedbackEvolution = generateEvolutionFeedbackStrategyEvolutionSyncReport();

  const feedbackAdjustedAverageScore =
    feedbackEvolution.entries.length === 0
      ? 0
      : Number(
          (
            feedbackEvolution.entries.reduce(
              (sum, entry) => sum + entry.adjustedEvolutionScore,
              0
            ) / feedbackEvolution.entries.length
          ).toFixed(2)
        );

  const feedbackBoost = calculateFeedbackBoost({
    feedbackAdjustedAverageScore,
    breakthroughStrategies: feedbackEvolution.breakthroughStrategies,
    evolvingStrategies: feedbackEvolution.evolvingStrategies,
    decliningStrategies: feedbackEvolution.decliningStrategies,
    underReviewStrategies: feedbackEvolution.underReviewStrategies,
  });

  const adjustedAutonomousEvolutionScore = clamp(
    Math.round(autonomous.autonomousEvolutionScore + feedbackBoost),
    0,
    100
  );

  const adjustedCycleDecision = resolveCycleDecision(
    adjustedAutonomousEvolutionScore
  );

  const mutationPressureMode = resolveMutationPressureMode({
    underReviewStrategies: feedbackEvolution.underReviewStrategies,
    decliningStrategies: feedbackEvolution.decliningStrategies,
    breakthroughStrategies: feedbackEvolution.breakthroughStrategies,
  });

  const autonomousRiskBias = resolveAutonomousRiskBias({
    adjustedScore: adjustedAutonomousEvolutionScore,
    mutationPressureMode,
  });

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",

    baseAutonomousEvolutionScore: autonomous.autonomousEvolutionScore,
    feedbackAdjustedAverageScore,
    feedbackBoost,
    adjustedAutonomousEvolutionScore,

    baseCycleDecision: autonomous.cycleDecision,
    adjustedCycleDecision,

    topAdjustedStrategy: feedbackEvolution.strongestAdjustedEvolution,
    weakestAdjustedStrategy: feedbackEvolution.weakestAdjustedEvolution,

    breakthroughStrategies: feedbackEvolution.breakthroughStrategies,
    evolvingStrategies: feedbackEvolution.evolvingStrategies,
    stableStrategies: feedbackEvolution.stableStrategies,
    decliningStrategies: feedbackEvolution.decliningStrategies,
    underReviewStrategies: feedbackEvolution.underReviewStrategies,

    mutationPressureMode,
    autonomousRiskBias,

    systemRule:
      "Strategy Evolution Autonomous Sync overlays V16 feedback-adjusted strategy evolution on Autonomous Trading Evolution without mutating the legacy V16.0.0 autonomous engine.",
    recommendation: buildRecommendation({
      adjustedCycleDecision,
      autonomousRiskBias,
    }),
    updatedAt: new Date().toISOString(),
  };
}
