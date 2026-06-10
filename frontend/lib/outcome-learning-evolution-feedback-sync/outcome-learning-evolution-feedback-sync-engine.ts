import { generatePerformanceOutcomeLearningSyncReport } from "@/lib/performance-outcome-learning-sync";

import {
  EvolutionFeedbackDecision,
  EvolutionFeedbackItem,
  MutationPressure,
  OutcomeLearningEvolutionFeedbackSyncReport,
} from "./outcome-learning-evolution-feedback-sync-types";

const VERSION = "V16.2.4" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveAllocationDelta(signal: string) {
  if (signal === "PROMOTE_STRATEGY") return 12;
  if (signal === "KEEP_STRATEGY") return 0;
  if (signal === "REDUCE_STRATEGY") return -12;
  return -25;
}

function resolveSurvivalScoreDelta(signal: string) {
  if (signal === "PROMOTE_STRATEGY") return 15;
  if (signal === "KEEP_STRATEGY") return 0;
  if (signal === "REDUCE_STRATEGY") return -10;
  return -30;
}

function resolveMutationPressure(params: {
  learningSignal: string;
  riskAction: string;
  evolutionImpactScore: number;
}): MutationPressure {
  if (
    params.learningSignal === "PAUSE_STRATEGY" ||
    params.riskAction === "BLOCK_NEW_TRADES"
  ) {
    return "EXTREME";
  }

  if (
    params.learningSignal === "REDUCE_STRATEGY" ||
    params.riskAction === "REQUIRE_REVIEW"
  ) {
    return "HIGH";
  }

  if (
    params.learningSignal === "PROMOTE_STRATEGY" &&
    params.evolutionImpactScore >= 75
  ) {
    return "LOW";
  }

  return "NORMAL";
}

function calculateEvolutionFeedbackScore(params: {
  evolutionImpactScore: number;
  confidenceDelta: number;
  strategyWeightDelta: number;
  allocationDelta: number;
  survivalScoreDelta: number;
}) {
  return clamp(
    Math.round(
      params.evolutionImpactScore +
        params.confidenceDelta * 1.2 +
        params.strategyWeightDelta * 1.1 +
        params.allocationDelta * 0.8 +
        params.survivalScoreDelta * 0.9
    ),
    0,
    100
  );
}

function resolveEvolutionDecision(score: number): EvolutionFeedbackDecision {
  if (score >= 75) return "BOOST_EVOLUTION";
  if (score >= 50) return "MAINTAIN_EVOLUTION";
  if (score >= 30) return "REDUCE_EVOLUTION";
  return "PAUSE_EVOLUTION_REVIEW";
}

function resolveAutonomousCycleBias(
  decision: EvolutionFeedbackDecision
): EvolutionFeedbackItem["autonomousCycleBias"] {
  if (decision === "BOOST_EVOLUTION" || decision === "MAINTAIN_EVOLUTION") {
    return "CONTINUE_EVOLUTION";
  }

  if (decision === "REDUCE_EVOLUTION") return "REDUCE_RISK";

  return "PAUSE_EVOLUTION";
}

function buildReason(item: {
  learningSignal: string;
  evolutionDecision: EvolutionFeedbackDecision;
  evolutionFeedbackScore: number;
  mutationPressure: MutationPressure;
}) {
  return `Outcome Learning Evolution Feedback converted ${item.learningSignal} into ${item.evolutionDecision} with score ${item.evolutionFeedbackScore} and mutation pressure ${item.mutationPressure}.`;
}

function buildFeedbackItem(
  learningItem: ReturnType<typeof generatePerformanceOutcomeLearningSyncReport>["learningItems"][number]
): EvolutionFeedbackItem {
  const allocationDelta = resolveAllocationDelta(learningItem.learningSignal);
  const survivalScoreDelta = resolveSurvivalScoreDelta(
    learningItem.learningSignal
  );

  const mutationPressure = resolveMutationPressure({
    learningSignal: learningItem.learningSignal,
    riskAction: learningItem.riskAction,
    evolutionImpactScore: learningItem.evolutionImpactScore,
  });

  const evolutionFeedbackScore = calculateEvolutionFeedbackScore({
    evolutionImpactScore: learningItem.evolutionImpactScore,
    confidenceDelta: learningItem.confidenceAdjustment,
    strategyWeightDelta: learningItem.strategyWeightAdjustment,
    allocationDelta,
    survivalScoreDelta,
  });

  const evolutionDecision =
    resolveEvolutionDecision(evolutionFeedbackScore);

  const autonomousCycleBias =
    resolveAutonomousCycleBias(evolutionDecision);

  return {
    id: `evolution-feedback-${learningItem.id}`,
    sourceLearningId: learningItem.id,
    learningSignal: learningItem.learningSignal,
    riskAction: learningItem.riskAction,
    performanceScore: learningItem.performanceScore,
    evolutionImpactScore: learningItem.evolutionImpactScore,
    confidenceDelta: learningItem.confidenceAdjustment,
    strategyWeightDelta: learningItem.strategyWeightAdjustment,
    allocationDelta,
    survivalScoreDelta,
    mutationPressure,
    evolutionFeedbackScore,
    evolutionDecision,
    autonomousCycleBias,
    reason: buildReason({
      learningSignal: learningItem.learningSignal,
      evolutionDecision,
      evolutionFeedbackScore,
      mutationPressure,
    }),
  };
}

export function generateOutcomeLearningEvolutionFeedbackSyncReport():
  OutcomeLearningEvolutionFeedbackSyncReport {
  const learning = generatePerformanceOutcomeLearningSyncReport();

  const feedbackItems = learning.learningItems.map(buildFeedbackItem);

  const boostItems = feedbackItems.filter(
    (item) => item.evolutionDecision === "BOOST_EVOLUTION"
  ).length;

  const maintainItems = feedbackItems.filter(
    (item) => item.evolutionDecision === "MAINTAIN_EVOLUTION"
  ).length;

  const reduceItems = feedbackItems.filter(
    (item) => item.evolutionDecision === "REDUCE_EVOLUTION"
  ).length;

  const pauseItems = feedbackItems.filter(
    (item) => item.evolutionDecision === "PAUSE_EVOLUTION_REVIEW"
  ).length;

  const averageEvolutionFeedbackScore =
    feedbackItems.length === 0
      ? 0
      : Number(
          (
            feedbackItems.reduce(
              (sum, item) => sum + item.evolutionFeedbackScore,
              0
            ) / feedbackItems.length
          ).toFixed(2)
        );

  const strongestFeedbackItem =
    feedbackItems.length === 0
      ? null
      : [...feedbackItems].sort(
          (a, b) => b.evolutionFeedbackScore - a.evolutionFeedbackScore
        )[0];

  const recommendation =
    boostItems > 0
      ? "Evolution feedback supports controlled evolution boost."
      : maintainItems > 0
        ? "Evolution feedback recommends maintaining current evolution direction."
        : reduceItems > 0
          ? "Evolution feedback recommends reducing evolution risk."
          : "Evolution feedback recommends pausing evolution review.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalFeedbackItems: feedbackItems.length,
    boostItems,
    maintainItems,
    reduceItems,
    pauseItems,
    averageEvolutionFeedbackScore,
    strongestFeedbackItem,
    feedbackItems,
    systemRule:
      "Outcome Learning Evolution Feedback Sync converts V16 paper learning into evolution feedback deltas for strategy evolution, survival, allocation and autonomous evolution bias.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
