import { generatePaperAccountPerformanceSyncReport } from "@/lib/paper-account-performance-sync";

import {
  OutcomeLearningRiskAction,
  OutcomeLearningSignal,
  PerformanceOutcomeLearningItem,
  PerformanceOutcomeLearningSyncReport,
} from "./performance-outcome-learning-sync-types";

const VERSION = "V16.2.3" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveLearningSignal(params: {
  performanceScore: number;
  riskGrade: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
}): OutcomeLearningSignal {
  if (params.riskGrade === "BLOCKED" || params.performanceScore < 30) {
    return "PAUSE_STRATEGY";
  }

  if (params.performanceScore < 50) {
    return "REDUCE_STRATEGY";
  }

  if (params.totalTrades < 5) {
    return "KEEP_STRATEGY";
  }

  if (
    params.performanceScore >= 70 &&
    params.winRate >= 55 &&
    params.profitFactor >= 1.2
  ) {
    return "PROMOTE_STRATEGY";
  }

  if (params.performanceScore >= 50) {
    return "KEEP_STRATEGY";
  }

  return "REDUCE_STRATEGY";
}

function resolveRiskAction(params: {
  riskGrade: string;
  learningSignal: OutcomeLearningSignal;
}): OutcomeLearningRiskAction {
  if (
    params.riskGrade === "BLOCKED" ||
    params.learningSignal === "PAUSE_STRATEGY"
  ) {
    return "BLOCK_NEW_TRADES";
  }

  if (
    params.riskGrade === "WEAK" ||
    params.learningSignal === "REDUCE_STRATEGY"
  ) {
    return "REQUIRE_REVIEW";
  }

  if (params.riskGrade === "NEUTRAL") {
    return "ALLOW_REDUCED_RISK";
  }

  return "ALLOW_NORMAL_RISK";
}

function calculateConfidenceAdjustment(params: {
  learningSignal: OutcomeLearningSignal;
  performanceScore: number;
}) {
  if (params.learningSignal === "PROMOTE_STRATEGY") {
    return clamp(Math.round((params.performanceScore - 70) / 3) + 3, 3, 10);
  }

  if (params.learningSignal === "KEEP_STRATEGY") {
    return 0;
  }

  if (params.learningSignal === "REDUCE_STRATEGY") {
    return -5;
  }

  return -10;
}

function calculateStrategyWeightAdjustment(signal: OutcomeLearningSignal) {
  if (signal === "PROMOTE_STRATEGY") return 8;
  if (signal === "KEEP_STRATEGY") return 0;
  if (signal === "REDUCE_STRATEGY") return -8;
  return -20;
}

function calculateEvolutionImpactScore(params: {
  performanceScore: number;
  confidenceAdjustment: number;
  strategyWeightAdjustment: number;
  returnPercent: number;
}) {
  return clamp(
    Math.round(
      params.performanceScore +
        params.confidenceAdjustment * 2 +
        params.strategyWeightAdjustment * 1.5 +
        params.returnPercent * 4
    ),
    0,
    100
  );
}

function buildReason(params: {
  learningSignal: OutcomeLearningSignal;
  performanceScore: number;
  riskGrade: string;
  totalTrades: number;
}) {
  return `Performance Outcome Learning resolved ${params.learningSignal} from score ${params.performanceScore}, risk grade ${params.riskGrade}, and ${params.totalTrades} paper trade(s).`;
}

function buildLearningItem(): PerformanceOutcomeLearningItem {
  const performance = generatePaperAccountPerformanceSyncReport();

  const learningSignal = resolveLearningSignal({
    performanceScore: performance.performanceScore,
    riskGrade: performance.riskGrade,
    totalTrades: performance.totalTrades,
    winRate: performance.winRate,
    profitFactor: performance.profitFactor,
  });

  const riskAction = resolveRiskAction({
    riskGrade: performance.riskGrade,
    learningSignal,
  });

  const confidenceAdjustment = calculateConfidenceAdjustment({
    learningSignal,
    performanceScore: performance.performanceScore,
  });

  const strategyWeightAdjustment =
    calculateStrategyWeightAdjustment(learningSignal);

  const evolutionImpactScore = calculateEvolutionImpactScore({
    performanceScore: performance.performanceScore,
    confidenceAdjustment,
    strategyWeightAdjustment,
    returnPercent: performance.returnPercent,
  });

  return {
    id: `performance-outcome-learning-${performance.updatedAt}`,
    source: "PAPER_ACCOUNT_PERFORMANCE",
    performanceScore: performance.performanceScore,
    riskGrade: performance.riskGrade,
    totalTrades: performance.totalTrades,
    winRate: performance.winRate,
    lossRate: performance.lossRate,
    profitFactor: performance.profitFactor,
    netPnL: performance.netPnL,
    returnPercent: performance.returnPercent,
    averagePnL: performance.averagePnL,
    bestPnL: performance.bestPnL,
    worstPnL: performance.worstPnL,
    learningSignal,
    riskAction,
    confidenceAdjustment,
    strategyWeightAdjustment,
    evolutionImpactScore,
    reason: buildReason({
      learningSignal,
      performanceScore: performance.performanceScore,
      riskGrade: performance.riskGrade,
      totalTrades: performance.totalTrades,
    }),
  };
}

export function generatePerformanceOutcomeLearningSyncReport():
  PerformanceOutcomeLearningSyncReport {
  const learningItems = [buildLearningItem()];

  const promoteSignals = learningItems.filter(
    (item) => item.learningSignal === "PROMOTE_STRATEGY"
  ).length;

  const keepSignals = learningItems.filter(
    (item) => item.learningSignal === "KEEP_STRATEGY"
  ).length;

  const reduceSignals = learningItems.filter(
    (item) => item.learningSignal === "REDUCE_STRATEGY"
  ).length;

  const pauseSignals = learningItems.filter(
    (item) => item.learningSignal === "PAUSE_STRATEGY"
  ).length;

  const averageEvolutionImpactScore =
    learningItems.length === 0
      ? 0
      : Number(
          (
            learningItems.reduce(
              (sum, item) => sum + item.evolutionImpactScore,
              0
            ) / learningItems.length
          ).toFixed(2)
        );

  const bestLearningItem =
    learningItems.length === 0
      ? null
      : [...learningItems].sort(
          (a, b) => b.evolutionImpactScore - a.evolutionImpactScore
        )[0];

  const recommendation =
    promoteSignals > 0
      ? "Performance learning supports strategy promotion after more confirmation."
      : keepSignals > 0
        ? "Performance learning recommends keeping strategy exposure stable until more paper outcomes are available."
        : reduceSignals > 0
          ? "Performance learning recommends reducing strategy exposure."
          : "Performance learning recommends pausing new trades.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalLearningItems: learningItems.length,
    promoteSignals,
    keepSignals,
    reduceSignals,
    pauseSignals,
    averageEvolutionImpactScore,
    bestLearningItem,
    learningItems,
    systemRule:
      "Performance Outcome Learning Sync converts V16 paper performance metrics into learning signals for strategy evolution. Live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
