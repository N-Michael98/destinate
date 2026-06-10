import { generatePortfolioBrainEvolutionSyncReport } from "@/lib/portfolio-brain-evolution-sync";

import {
  PositionSizingEvolutionMode,
  PositionSizingEvolutionSyncReport,
} from "./position-sizing-evolution-sync-types";

const VERSION = "V16.2.8" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function resolveAllocationMultiplier(params: {
  autonomousRiskBias: string;
  riskMode: string;
  adjustedScore: number;
  portfolioRiskAdjustment: number;
}) {
  if (
    params.autonomousRiskBias === "PAUSE" ||
    params.riskMode === "PAUSE" ||
    params.adjustedScore < 50
  ) {
    return 0.5;
  }

  if (
    params.autonomousRiskBias === "DEFENSIVE" ||
    params.riskMode === "REDUCE" ||
    params.portfolioRiskAdjustment < 0
  ) {
    return 0.75;
  }

  if (
    params.autonomousRiskBias === "EXPAND" ||
    params.riskMode === "EXPAND" ||
    params.adjustedScore >= 85
  ) {
    return 1.5;
  }

  if (params.adjustedScore >= 75) return 1.25;

  return 1;
}

function resolveRiskPercentMultiplier(params: {
  allocationMultiplier: number;
  mutationPressureMode: string;
}) {
  const pressurePenalty =
    params.mutationPressureMode === "EXTREME"
      ? 0.5
      : params.mutationPressureMode === "HIGH"
        ? 0.75
        : 1;

  return round(params.allocationMultiplier * pressurePenalty);
}

function resolveMaxPositionMultiplier(params: {
  allocationMultiplier: number;
  riskPercentMultiplier: number;
}) {
  return round(
    Math.min(params.allocationMultiplier, params.riskPercentMultiplier)
  );
}

function calculateEvolutionPositionSizeScore(params: {
  adjustedScore: number;
  portfolioRiskAdjustment: number;
  allocationMultiplier: number;
  riskPercentMultiplier: number;
}) {
  return clamp(
    Math.round(
      params.adjustedScore * 0.55 +
        params.portfolioRiskAdjustment * 0.6 +
        params.allocationMultiplier * 12 +
        params.riskPercentMultiplier * 8
    ),
    0,
    100
  );
}

function resolveSizingMode(score: number): PositionSizingEvolutionMode {
  if (score >= 80) return "EXPAND_SIZE";
  if (score >= 60) return "NORMAL_SIZE";
  if (score >= 40) return "REDUCE_SIZE";
  return "MINIMUM_SIZE";
}

function buildRecommendation(mode: PositionSizingEvolutionMode) {
  if (mode === "EXPAND_SIZE") {
    return "Position sizing evolution supports controlled size expansion under simulation rules.";
  }

  if (mode === "NORMAL_SIZE") {
    return "Position sizing evolution supports normal position size.";
  }

  if (mode === "REDUCE_SIZE") {
    return "Position sizing evolution recommends reduced position size.";
  }

  return "Position sizing evolution recommends minimum position size only.";
}

export function generatePositionSizingEvolutionSyncReport():
  PositionSizingEvolutionSyncReport {
  const portfolio = generatePortfolioBrainEvolutionSyncReport();
  const signal = portfolio.autonomousEvolutionSignal;

  const allocationMultiplier = resolveAllocationMultiplier({
    autonomousRiskBias: signal.autonomousRiskBias,
    riskMode: signal.riskMode,
    adjustedScore: signal.adjustedAutonomousEvolutionScore,
    portfolioRiskAdjustment: portfolio.portfolioRiskAdjustment,
  });

  const adjustedRiskPercentMultiplier = resolveRiskPercentMultiplier({
    allocationMultiplier,
    mutationPressureMode: signal.mutationPressureMode,
  });

  const maxPositionMultiplier = resolveMaxPositionMultiplier({
    allocationMultiplier,
    riskPercentMultiplier: adjustedRiskPercentMultiplier,
  });

  const evolutionPositionSizeScore = calculateEvolutionPositionSizeScore({
    adjustedScore: signal.adjustedAutonomousEvolutionScore,
    portfolioRiskAdjustment: portfolio.portfolioRiskAdjustment,
    allocationMultiplier,
    riskPercentMultiplier: adjustedRiskPercentMultiplier,
  });

  const positionSizingMode = resolveSizingMode(evolutionPositionSizeScore);

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",

    sourcePortfolioVersion: portfolio.version,
    championSpecies: portfolio.championSpecies,
    topStrategy: signal.topStrategy,
    topAdjustedStrategy: signal.topAdjustedStrategy,
    weakestAdjustedStrategy: signal.weakestAdjustedStrategy,

    adjustedAutonomousEvolutionScore: signal.adjustedAutonomousEvolutionScore,
    adjustedCycleDecision: signal.adjustedCycleDecision,
    autonomousRiskBias: signal.autonomousRiskBias,
    riskMode: signal.riskMode,
    portfolioRiskAdjustment: portfolio.portfolioRiskAdjustment,
    mutationPressureMode: signal.mutationPressureMode,

    allocationMultiplier,
    adjustedRiskPercentMultiplier,
    maxPositionMultiplier,
    evolutionPositionSizeScore,
    positionSizingMode,

    liveExecutionEnabled: false,
    orderExecutionEnabled: false,

    systemRule:
      "Position Sizing Evolution Sync converts Portfolio Brain Evolution into simulated allocation and risk multipliers. It does not execute trades.",
    recommendation: buildRecommendation(positionSizingMode),
    updatedAt: new Date().toISOString(),
  };
}
