import { generateAdaptiveBrokerWeightingReport } from "../adaptive-broker-weighting";
import { BrokerId } from "../smart-broker-selection";

import {
  AutonomousBrokerOptimizationReport,
  AutonomousBrokerOptimizationStatus,
  BrokerOptimizationAction,
  BrokerOptimizationProfile,
} from "./autonomous-broker-optimization-types";

const VERSION = "V12.5.0" as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function calculateTrendScore(params: {
  executionQualityScore: number;
  averageLatencyMs: number;
  averageSpreadPoints: number;
  averageSlippagePoints: number;
  averageFillQualityScore: number;
  averageLiquidityScore: number;
  averageRejectionRiskScore: number;
}): number {
  let score = 50;

  if (params.executionQualityScore >= 85) score += 12;
  if (params.executionQualityScore >= 90) score += 6;
  if (params.averageLatencyMs <= 45) score += 8;
  if (params.averageLatencyMs > 70) score -= 8;
  if (params.averageSpreadPoints <= 12) score += 6;
  if (params.averageSpreadPoints > 18) score -= 8;
  if (params.averageSlippagePoints <= 0.5) score += 8;
  if (params.averageSlippagePoints > 0.8) score -= 8;
  if (params.averageFillQualityScore >= 88) score += 8;
  if (params.averageFillQualityScore < 82) score -= 8;
  if (params.averageLiquidityScore >= 88) score += 6;
  if (params.averageLiquidityScore < 82) score -= 6;
  if (params.averageRejectionRiskScore <= 10) score += 6;
  if (params.averageRejectionRiskScore > 15) score -= 10;

  return clamp(round0(score), 0, 100);
}

function calculateReliabilityScore(params: {
  executionQualityScore: number;
  totalSamples: number;
  averageRejectionRiskScore: number;
  averageLatencyMs: number;
  averageSlippagePoints: number;
}): number {
  let score = 50;

  score += (params.executionQualityScore - 75) * 0.8;
  if (params.totalSamples >= 3) score += 6;
  if (params.totalSamples >= 10) score += 8;
  if (params.averageRejectionRiskScore <= 10) score += 8;
  if (params.averageRejectionRiskScore > 15) score -= 12;
  if (params.averageLatencyMs <= 50) score += 6;
  if (params.averageLatencyMs > 80) score -= 10;
  if (params.averageSlippagePoints <= 0.5) score += 6;
  if (params.averageSlippagePoints > 0.9) score -= 10;

  return clamp(round0(score), 0, 100);
}

function calculateOptimizationConfidence(params: {
  executionQualityScore: number;
  trendScore: number;
  reliabilityScore: number;
  finalAdaptiveWeight: number;
}): number {
  return clamp(
    round0(
      params.executionQualityScore * 0.35 +
        params.trendScore * 0.3 +
        params.reliabilityScore * 0.25 +
        params.finalAdaptiveWeight * 0.1
    ),
    0,
    100
  );
}

function resolveRecommendedAction(params: {
  currentNormalizedWeight: number;
  recommendedWeight: number;
  optimizationConfidence: number;
}): BrokerOptimizationAction {
  const difference = params.recommendedWeight - params.currentNormalizedWeight;

  if (params.optimizationConfidence < 50) {
    return "BLOCK_BROKER";
  }

  if (difference >= 3) {
    return "INCREASE_WEIGHT";
  }

  if (difference <= -3) {
    return "DECREASE_WEIGHT";
  }

  return "HOLD_WEIGHT";
}

function resolveProfileStatus(
  action: BrokerOptimizationAction,
  confidence: number
): AutonomousBrokerOptimizationStatus {
  if (action === "BLOCK_BROKER" || confidence < 50) {
    return "BLOCKED";
  }

  if (action === "INCREASE_WEIGHT" || action === "DECREASE_WEIGHT") {
    return "OPTIMIZED";
  }

  return "MONITORING";
}

function buildReasons(params: {
  brokerName: string;
  action: BrokerOptimizationAction;
  executionQualityScore: number;
  trendScore: number;
  reliabilityScore: number;
  optimizationConfidence: number;
  currentNormalizedWeight: number;
  recommendedWeight: number;
}): string[] {
  const reasons: string[] = [];

  reasons.push(`${params.brokerName} optimization confidence is ${params.optimizationConfidence}.`);
  reasons.push(`Execution quality ${params.executionQualityScore}, trend score ${params.trendScore}, reliability score ${params.reliabilityScore}.`);

  if (params.action === "INCREASE_WEIGHT") {
    reasons.push(`Recommended to increase weight from ${params.currentNormalizedWeight}% to ${params.recommendedWeight}%.`);
  }

  if (params.action === "DECREASE_WEIGHT") {
    reasons.push(`Recommended to decrease weight from ${params.currentNormalizedWeight}% to ${params.recommendedWeight}%.`);
  }

  if (params.action === "HOLD_WEIGHT") {
    reasons.push(`Recommended to hold weight near ${params.currentNormalizedWeight}% because optimization delta is small.`);
  }

  if (params.action === "BLOCK_BROKER") {
    reasons.push("Recommended to block broker in simulation because optimization confidence is too weak.");
  }

  return reasons;
}

function normalizeOptimizedWeights(
  profiles: Omit<
    BrokerOptimizationProfile,
    "recommendedWeight" | "recommendedAction" | "status" | "reasons"
  >[]
): Record<BrokerId, number> {
  const rawCapital = profiles.find((profile) => profile.brokerId === "CAPITAL_COM");
  const rawIc = profiles.find((profile) => profile.brokerId === "IC_MARKETS");

  const capitalRaw = rawCapital
    ? Math.max(
        0,
        rawCapital.currentNormalizedWeight * 0.45 +
          rawCapital.optimizationConfidence * 0.35 +
          rawCapital.trendScore * 0.2
      )
    : 0;

  const icRaw = rawIc
    ? Math.max(
        0,
        rawIc.currentNormalizedWeight * 0.45 +
          rawIc.optimizationConfidence * 0.35 +
          rawIc.trendScore * 0.2
      )
    : 0;

  const total = capitalRaw + icRaw;

  if (total <= 0) {
    return {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };
  }

  const capitalWeight = round0((capitalRaw / total) * 100);

  return {
    CAPITAL_COM: capitalWeight,
    IC_MARKETS: 100 - capitalWeight,
  };
}

function buildOptimizationProfiles(): BrokerOptimizationProfile[] {
  const adaptiveReport = generateAdaptiveBrokerWeightingReport();

  const profileBase = adaptiveReport.brokerWeights.map((broker) => {
    const trendScore = calculateTrendScore({
      executionQualityScore: broker.executionQualityScore,
      averageLatencyMs: broker.metrics.averageLatencyMs,
      averageSpreadPoints: broker.metrics.averageSpreadPoints,
      averageSlippagePoints: broker.metrics.averageSlippagePoints,
      averageFillQualityScore: broker.metrics.averageFillQualityScore,
      averageLiquidityScore: broker.metrics.averageLiquidityScore,
      averageRejectionRiskScore: broker.metrics.averageRejectionRiskScore,
    });

    const reliabilityScore = calculateReliabilityScore({
      executionQualityScore: broker.executionQualityScore,
      totalSamples: broker.metrics.totalSamples,
      averageRejectionRiskScore: broker.metrics.averageRejectionRiskScore,
      averageLatencyMs: broker.metrics.averageLatencyMs,
      averageSlippagePoints: broker.metrics.averageSlippagePoints,
    });

    const optimizationConfidence = calculateOptimizationConfidence({
      executionQualityScore: broker.executionQualityScore,
      trendScore,
      reliabilityScore,
      finalAdaptiveWeight: broker.finalWeight,
    });

    return {
      brokerId: broker.brokerId,
      brokerName: broker.brokerName,
      currentNormalizedWeight: adaptiveReport.normalizedWeights[broker.brokerId] ?? 0,
      executionQualityScore: broker.executionQualityScore,
      finalAdaptiveWeight: broker.finalWeight,
      trendScore,
      reliabilityScore,
      optimizationConfidence,
      metrics: broker.metrics,
    };
  });

  const optimizedWeights = normalizeOptimizedWeights(profileBase);

  return profileBase
    .map((profile) => {
      const recommendedWeight = optimizedWeights[profile.brokerId];
      const recommendedAction = resolveRecommendedAction({
        currentNormalizedWeight: profile.currentNormalizedWeight,
        recommendedWeight,
        optimizationConfidence: profile.optimizationConfidence,
      });

      const status = resolveProfileStatus(recommendedAction, profile.optimizationConfidence);

      return {
        ...profile,
        recommendedWeight,
        recommendedAction,
        status,
        reasons: buildReasons({
          brokerName: profile.brokerName,
          action: recommendedAction,
          executionQualityScore: profile.executionQualityScore,
          trendScore: profile.trendScore,
          reliabilityScore: profile.reliabilityScore,
          optimizationConfidence: profile.optimizationConfidence,
          currentNormalizedWeight: profile.currentNormalizedWeight,
          recommendedWeight,
        }),
      };
    })
    .sort((a, b) => b.recommendedWeight - a.recommendedWeight);
}

function resolveReportStatus(
  profiles: BrokerOptimizationProfile[]
): AutonomousBrokerOptimizationStatus {
  if (profiles.every((profile) => profile.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (profiles.some((profile) => profile.status === "OPTIMIZED")) {
    return "OPTIMIZED";
  }

  return "READY";
}

function resolveStrongestBroker(
  profiles: BrokerOptimizationProfile[]
): BrokerId | "NONE" {
  const strongest = profiles
    .filter((profile) => profile.status !== "BLOCKED")
    .sort((a, b) => b.optimizationConfidence - a.optimizationConfidence)[0];

  if (!strongest) return "NONE";

  return strongest.brokerId;
}

function resolveWeakestBroker(
  profiles: BrokerOptimizationProfile[]
): BrokerId | "NONE" {
  const weakest = profiles
    .filter((profile) => profile.status !== "BLOCKED")
    .sort((a, b) => a.optimizationConfidence - b.optimizationConfidence)[0];

  if (!weakest) return "NONE";

  return weakest.brokerId;
}

function resolveRecommendedBroker(
  profiles: BrokerOptimizationProfile[]
): BrokerId | "NONE" {
  const recommended = profiles
    .filter((profile) => profile.status !== "BLOCKED")
    .sort((a, b) => b.recommendedWeight - a.recommendedWeight)[0];

  if (!recommended || recommended.recommendedWeight <= 0) {
    return "NONE";
  }

  return recommended.brokerId;
}

function buildOptimizationNotes(profiles: BrokerOptimizationProfile[]): string[] {
  return profiles.map((profile) => {
    return `${profile.brokerName}: current ${profile.currentNormalizedWeight}%, recommended ${profile.recommendedWeight}%, confidence ${profile.optimizationConfidence}, action ${profile.recommendedAction}.`;
  });
}

function buildOptimizedWeightRecord(
  profiles: BrokerOptimizationProfile[]
): Record<BrokerId, number> {
  const capital = profiles.find((profile) => profile.brokerId === "CAPITAL_COM");
  const ic = profiles.find((profile) => profile.brokerId === "IC_MARKETS");

  return {
    CAPITAL_COM: capital?.recommendedWeight ?? 0,
    IC_MARKETS: ic?.recommendedWeight ?? 0,
  };
}

export function generateAutonomousBrokerOptimizationReport(): AutonomousBrokerOptimizationReport {
  const optimizationProfiles = buildOptimizationProfiles();

  return {
    version: VERSION,
    status: resolveReportStatus(optimizationProfiles),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalBrokers: optimizationProfiles.length,
    recommendedBroker: resolveRecommendedBroker(optimizationProfiles),
    strongestBroker: resolveStrongestBroker(optimizationProfiles),
    weakestBroker: resolveWeakestBroker(optimizationProfiles),
    optimizationProfiles,
    optimizedWeights: buildOptimizedWeightRecord(optimizationProfiles),
    summary:
      "Autonomous Broker Optimization converted adaptive broker weights and execution quality memory into simulated optimized broker recommendations.",
    optimizationNotes: buildOptimizationNotes(optimizationProfiles),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      optimizationMode: "SIMULATED_AUTONOMOUS_BROKER_OPTIMIZATION",
    },
    createdAt: new Date().toISOString(),
  };
}
