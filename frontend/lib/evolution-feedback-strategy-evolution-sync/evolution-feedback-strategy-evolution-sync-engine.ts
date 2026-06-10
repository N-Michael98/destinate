import { generateStrategyEvolutionReport } from "@/lib/strategy-evolution-intelligence";
import { generateOutcomeLearningEvolutionFeedbackSyncReport } from "@/lib/outcome-learning-evolution-feedback-sync";

import {
  EvolutionFeedbackStrategyEvolutionEntry,
  EvolutionFeedbackStrategyEvolutionSyncReport,
  FeedbackAdjustedEvolutionStatus,
} from "./evolution-feedback-strategy-evolution-sync-types";

const VERSION = "V16.2.5" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number) {
  return Math.round(value);
}

function resolveAdjustedStatus(params: {
  score: number;
  growthRate: number;
  decayRisk: number;
  feedbackDecision: string;
}): FeedbackAdjustedEvolutionStatus {
  if (
    params.feedbackDecision === "PAUSE_EVOLUTION_REVIEW" ||
    params.decayRisk >= 75
  ) {
    return "UNDER_REVIEW";
  }

  if (params.score >= 90 && params.growthRate >= 10) return "BREAKTHROUGH";
  if (params.score >= 75) return "EVOLVING";
  if (params.score >= 55) return "STABLE";

  return "DECLINING";
}

function resolveFeedbackScore(feedbackDecision: string) {
  if (feedbackDecision === "BOOST_EVOLUTION") return 12;
  if (feedbackDecision === "MAINTAIN_EVOLUTION") return 0;
  if (feedbackDecision === "REDUCE_EVOLUTION") return -12;
  return -25;
}

function calculateAdjustedEvolutionScore(params: {
  baseEvolutionScore: number;
  feedbackScore: number;
  confidenceDelta: number;
  strategyWeightDelta: number;
  allocationDelta: number;
  survivalScoreDelta: number;
}) {
  return clamp(
    round0(
      params.baseEvolutionScore +
        params.feedbackScore * 0.55 +
        params.confidenceDelta * 0.8 +
        params.strategyWeightDelta * 0.65 +
        params.allocationDelta * 0.35 +
        params.survivalScoreDelta * 0.45
    ),
    0,
    100
  );
}

function calculateAdjustedGrowthRate(params: {
  baseGrowthRate: number;
  confidenceDelta: number;
  strategyWeightDelta: number;
  feedbackDecision: string;
}) {
  const feedbackGrowth =
    params.feedbackDecision === "BOOST_EVOLUTION"
      ? 4
      : params.feedbackDecision === "MAINTAIN_EVOLUTION"
        ? 0
        : params.feedbackDecision === "REDUCE_EVOLUTION"
          ? -4
          : -10;

  return clamp(
    round0(
      params.baseGrowthRate +
        params.confidenceDelta * 0.3 +
        params.strategyWeightDelta * 0.25 +
        feedbackGrowth
    ),
    -100,
    100
  );
}

function calculateAdjustedDecayRisk(params: {
  baseDecayRisk: number;
  mutationPressure: string;
  survivalScoreDelta: number;
  feedbackDecision: string;
}) {
  const pressurePenalty =
    params.mutationPressure === "EXTREME"
      ? 18
      : params.mutationPressure === "HIGH"
        ? 10
        : params.mutationPressure === "LOW"
          ? -6
          : 0;

  const feedbackPenalty =
    params.feedbackDecision === "PAUSE_EVOLUTION_REVIEW"
      ? 15
      : params.feedbackDecision === "REDUCE_EVOLUTION"
        ? 8
        : params.feedbackDecision === "BOOST_EVOLUTION"
          ? -5
          : 0;

  return clamp(
    round0(
      params.baseDecayRisk -
        params.survivalScoreDelta * 0.3 +
        pressurePenalty +
        feedbackPenalty
    ),
    0,
    100
  );
}

function buildReason(params: {
  strategyName: string;
  baseEvolutionScore: number;
  adjustedEvolutionScore: number;
  feedbackDecision: string;
  mutationPressure: string;
}) {
  return `${params.strategyName}: base evolution ${params.baseEvolutionScore} adjusted to ${params.adjustedEvolutionScore} using ${params.feedbackDecision} and mutation pressure ${params.mutationPressure}.`;
}

function buildEntry(params: {
  strategy: ReturnType<typeof generateStrategyEvolutionReport>["entries"][number];
  feedback: ReturnType<typeof generateOutcomeLearningEvolutionFeedbackSyncReport>["feedbackItems"][number] | null;
}): EvolutionFeedbackStrategyEvolutionEntry {
  const feedbackDecision = params.feedback?.evolutionDecision ?? "MAINTAIN_EVOLUTION";
  const feedbackScore = resolveFeedbackScore(feedbackDecision);
  const mutationPressure = params.feedback?.mutationPressure ?? "NORMAL";
  const confidenceDelta = params.feedback?.confidenceDelta ?? 0;
  const strategyWeightDelta = params.feedback?.strategyWeightDelta ?? 0;
  const allocationDelta = params.feedback?.allocationDelta ?? 0;
  const survivalScoreDelta = params.feedback?.survivalScoreDelta ?? 0;

  const adjustedEvolutionScore = calculateAdjustedEvolutionScore({
    baseEvolutionScore: params.strategy.evolutionScore,
    feedbackScore,
    confidenceDelta,
    strategyWeightDelta,
    allocationDelta,
    survivalScoreDelta,
  });

  const adjustedGrowthRate = calculateAdjustedGrowthRate({
    baseGrowthRate: params.strategy.growthRate,
    confidenceDelta,
    strategyWeightDelta,
    feedbackDecision,
  });

  const adjustedDecayRisk = calculateAdjustedDecayRisk({
    baseDecayRisk: params.strategy.decayRisk,
    mutationPressure,
    survivalScoreDelta,
    feedbackDecision,
  });

  const adjustedProjectedFutureScore = clamp(
    round0(
      adjustedEvolutionScore +
        adjustedGrowthRate -
        adjustedDecayRisk * 0.15
    ),
    0,
    100
  );

  const adjustedStatus = resolveAdjustedStatus({
    score: adjustedEvolutionScore,
    growthRate: adjustedGrowthRate,
    decayRisk: adjustedDecayRisk,
    feedbackDecision,
  });

  return {
    strategyId: params.strategy.strategyId,
    strategyName: params.strategy.strategyName,
    market: params.strategy.market,
    symbol: params.strategy.symbol,
    baseEvolutionScore: params.strategy.evolutionScore,
    feedbackScore,
    feedbackDecision,
    mutationPressure,
    confidenceDelta,
    strategyWeightDelta,
    allocationDelta,
    survivalScoreDelta,
    adjustedEvolutionScore,
    adjustedGrowthRate,
    adjustedDecayRisk,
    adjustedProjectedFutureScore,
    adjustedStatus,
    reason: buildReason({
      strategyName: params.strategy.strategyName,
      baseEvolutionScore: params.strategy.evolutionScore,
      adjustedEvolutionScore,
      feedbackDecision,
      mutationPressure,
    }),
  };
}

export function generateEvolutionFeedbackStrategyEvolutionSyncReport():
  EvolutionFeedbackStrategyEvolutionSyncReport {
  const strategyEvolution = generateStrategyEvolutionReport();
  const feedbackReport = generateOutcomeLearningEvolutionFeedbackSyncReport();

  const strongestFeedback =
    feedbackReport.strongestFeedbackItem ?? feedbackReport.feedbackItems[0] ?? null;

  const entries = strategyEvolution.entries
    .map((strategy) =>
      buildEntry({
        strategy,
        feedback: strongestFeedback,
      })
    )
    .sort((a, b) => b.adjustedEvolutionScore - a.adjustedEvolutionScore);

  const strongestAdjustedEvolution =
    entries[0]
      ? `${entries[0].strategyName} (${entries[0].adjustedEvolutionScore})`
      : "NONE";

  const weakestAdjustedEvolution =
    entries.length > 0
      ? `${entries[entries.length - 1].strategyName} (${entries[entries.length - 1].adjustedEvolutionScore})`
      : "NONE";

  const breakthroughStrategies = entries.filter(
    (entry) => entry.adjustedStatus === "BREAKTHROUGH"
  ).length;

  const evolvingStrategies = entries.filter(
    (entry) => entry.adjustedStatus === "EVOLVING"
  ).length;

  const stableStrategies = entries.filter(
    (entry) => entry.adjustedStatus === "STABLE"
  ).length;

  const decliningStrategies = entries.filter(
    (entry) => entry.adjustedStatus === "DECLINING"
  ).length;

  const underReviewStrategies = entries.filter(
    (entry) => entry.adjustedStatus === "UNDER_REVIEW"
  ).length;

  const recommendation =
    breakthroughStrategies > 0 || evolvingStrategies > 0
      ? "Feedback-adjusted Strategy Evolution supports continued evolution with controlled risk."
      : stableStrategies > 0
        ? "Feedback-adjusted Strategy Evolution is stable. Continue collecting paper outcomes."
        : underReviewStrategies > 0
          ? "Feedback-adjusted Strategy Evolution requires review before expansion."
          : "Feedback-adjusted Strategy Evolution is declining. Reduce evolution risk.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalStrategies: entries.length,
    breakthroughStrategies,
    evolvingStrategies,
    stableStrategies,
    decliningStrategies,
    underReviewStrategies,
    strongestAdjustedEvolution,
    weakestAdjustedEvolution,
    entries,
    systemRule:
      "Evolution Feedback Strategy Evolution Sync overlays V16 outcome feedback on Strategy Evolution Intelligence without mutating the legacy V13.3.0 engine.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
