import { generateAutonomousBrokerOptimizationReport } from "../autonomous-broker-optimization";
import { BrokerId } from "../smart-broker-selection";

import {
  BrokerReputationGrade,
  BrokerReputationMemoryItem,
  BrokerReputationMemoryReport,
  BrokerReputationMemoryStatus,
} from "./broker-reputation-memory-types";

const VERSION = "V12.6.0" as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function resolveGrade(score: number): BrokerReputationGrade {
  if (score >= 95) return "A_PLUS";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

function resolveStatus(score: number): BrokerReputationMemoryStatus {
  if (score >= 85) return "TRUSTED";
  if (score >= 75) return "READY";
  if (score >= 65) return "WATCHLIST";
  if (score >= 50) return "DEGRADED";
  return "BLOCKED";
}

function calculateExecutionTrustScore(params: {
  executionQualityScore: number;
  averageLatencyMs: number;
  averageSlippagePoints: number;
  averageFillQualityScore: number;
  averageRejectionRiskScore: number;
}): number {
  let score = params.executionQualityScore;

  if (params.averageLatencyMs <= 45) score += 4;
  if (params.averageLatencyMs > 70) score -= 8;

  if (params.averageSlippagePoints <= 0.5) score += 4;
  if (params.averageSlippagePoints > 0.8) score -= 8;

  if (params.averageFillQualityScore >= 88) score += 4;
  if (params.averageFillQualityScore < 82) score -= 8;

  if (params.averageRejectionRiskScore <= 10) score += 4;
  if (params.averageRejectionRiskScore > 15) score -= 10;

  return clamp(round0(score), 0, 100);
}

function calculateReliabilityTrustScore(params: {
  reliabilityScore: number;
  totalSamples: number;
  averageLatencyMs: number;
  averageSpreadPoints: number;
  averageRejectionRiskScore: number;
}): number {
  let score = params.reliabilityScore;

  if (params.totalSamples >= 3) score += 4;
  if (params.totalSamples >= 10) score += 8;

  if (params.averageLatencyMs <= 50) score += 3;
  if (params.averageLatencyMs > 80) score -= 8;

  if (params.averageSpreadPoints <= 12) score += 3;
  if (params.averageSpreadPoints > 18) score -= 8;

  if (params.averageRejectionRiskScore <= 10) score += 4;
  if (params.averageRejectionRiskScore > 15) score -= 10;

  return clamp(round0(score), 0, 100);
}

function calculateOptimizationTrustScore(params: {
  optimizationConfidence: number;
  trendScore: number;
  recommendedWeight: number;
  currentNormalizedWeight: number;
}): number {
  let score =
    params.optimizationConfidence * 0.55 +
    params.trendScore * 0.3 +
    params.recommendedWeight * 0.15;

  const weightDelta = params.recommendedWeight - params.currentNormalizedWeight;

  if (weightDelta >= 3) score += 3;
  if (weightDelta <= -5) score -= 4;

  return clamp(round0(score), 0, 100);
}

function calculateAllocationTrustScore(params: {
  recommendedWeight: number;
  optimizationConfidence: number;
  executionQualityScore: number;
}): number {
  const score =
    params.recommendedWeight * 0.45 +
    params.optimizationConfidence * 0.35 +
    params.executionQualityScore * 0.2;

  return clamp(round0(score), 0, 100);
}

function calculateMemoryStrength(params: {
  totalSamples: number;
  optimizationConfidence: number;
  reliabilityScore: number;
}): number {
  let score =
    params.optimizationConfidence * 0.45 +
    params.reliabilityScore * 0.35 +
    Math.min(params.totalSamples * 6, 20);

  return clamp(round0(score), 0, 100);
}

function calculateReputationScore(params: {
  executionTrustScore: number;
  reliabilityTrustScore: number;
  optimizationTrustScore: number;
  allocationTrustScore: number;
  memoryStrength: number;
}): number {
  return clamp(
    round0(
      params.executionTrustScore * 0.3 +
        params.reliabilityTrustScore * 0.25 +
        params.optimizationTrustScore * 0.25 +
        params.allocationTrustScore * 0.1 +
        params.memoryStrength * 0.1
    ),
    0,
    100
  );
}

function calculateRecommendedLongTermWeight(params: {
  reputationScore: number;
  currentOptimizedWeight: number;
  optimizationConfidence: number;
}): number {
  const raw =
    params.currentOptimizedWeight * 0.5 +
    params.reputationScore * 0.35 +
    params.optimizationConfidence * 0.15;

  return clamp(round0(raw), 0, 100);
}

function buildReasons(params: {
  brokerName: string;
  reputationScore: number;
  reputationGrade: BrokerReputationGrade;
  executionTrustScore: number;
  reliabilityTrustScore: number;
  optimizationTrustScore: number;
  recommendedLongTermWeight: number;
}): string[] {
  const reasons: string[] = [];

  reasons.push(
    `${params.brokerName} reputation score is ${params.reputationScore} with grade ${params.reputationGrade}.`
  );

  reasons.push(
    `Execution trust ${params.executionTrustScore}, reliability trust ${params.reliabilityTrustScore}, optimization trust ${params.optimizationTrustScore}.`
  );

  reasons.push(
    `Long-term simulated broker weight resolved to ${params.recommendedLongTermWeight}.`
  );

  if (params.reputationScore >= 85) {
    reasons.push("Broker is trusted for higher long-term allocation in simulation.");
  } else if (params.reputationScore >= 65) {
    reasons.push("Broker remains usable but should stay under reputation monitoring.");
  } else {
    reasons.push("Broker requires strict monitoring before increasing allocation.");
  }

  return reasons;
}

function buildReputationMemories(): BrokerReputationMemoryItem[] {
  const optimizationReport = generateAutonomousBrokerOptimizationReport();

  return optimizationReport.optimizationProfiles
    .map((profile) => {
      const executionTrustScore = calculateExecutionTrustScore({
        executionQualityScore: profile.executionQualityScore,
        averageLatencyMs: profile.metrics.averageLatencyMs,
        averageSlippagePoints: profile.metrics.averageSlippagePoints,
        averageFillQualityScore: profile.metrics.averageFillQualityScore,
        averageRejectionRiskScore: profile.metrics.averageRejectionRiskScore,
      });

      const reliabilityTrustScore = calculateReliabilityTrustScore({
        reliabilityScore: profile.reliabilityScore,
        totalSamples: profile.metrics.totalSamples,
        averageLatencyMs: profile.metrics.averageLatencyMs,
        averageSpreadPoints: profile.metrics.averageSpreadPoints,
        averageRejectionRiskScore: profile.metrics.averageRejectionRiskScore,
      });

      const optimizationTrustScore = calculateOptimizationTrustScore({
        optimizationConfidence: profile.optimizationConfidence,
        trendScore: profile.trendScore,
        recommendedWeight: profile.recommendedWeight,
        currentNormalizedWeight: profile.currentNormalizedWeight,
      });

      const allocationTrustScore = calculateAllocationTrustScore({
        recommendedWeight: profile.recommendedWeight,
        optimizationConfidence: profile.optimizationConfidence,
        executionQualityScore: profile.executionQualityScore,
      });

      const memoryStrength = calculateMemoryStrength({
        totalSamples: profile.metrics.totalSamples,
        optimizationConfidence: profile.optimizationConfidence,
        reliabilityScore: profile.reliabilityScore,
      });

      const reputationScore = calculateReputationScore({
        executionTrustScore,
        reliabilityTrustScore,
        optimizationTrustScore,
        allocationTrustScore,
        memoryStrength,
      });

      const reputationGrade = resolveGrade(reputationScore);
      const recommendedLongTermWeight = calculateRecommendedLongTermWeight({
        reputationScore,
        currentOptimizedWeight: profile.recommendedWeight,
        optimizationConfidence: profile.optimizationConfidence,
      });

      return {
        brokerId: profile.brokerId,
        brokerName: profile.brokerName,
        reputationScore,
        reputationGrade,
        status: resolveStatus(reputationScore),
        executionTrustScore,
        reliabilityTrustScore,
        optimizationTrustScore,
        allocationTrustScore,
        longTermBrokerGrade: reputationGrade,
        recommendedLongTermWeight,
        currentOptimizedWeight: profile.recommendedWeight,
        memoryStrength,
        reasons: buildReasons({
          brokerName: profile.brokerName,
          reputationScore,
          reputationGrade,
          executionTrustScore,
          reliabilityTrustScore,
          optimizationTrustScore,
          recommendedLongTermWeight,
        }),
        memorySignals: {
          executionQualityScore: profile.executionQualityScore,
          trendScore: profile.trendScore,
          reliabilityScore: profile.reliabilityScore,
          optimizationConfidence: profile.optimizationConfidence,
          currentNormalizedWeight: profile.currentNormalizedWeight,
          recommendedWeight: profile.recommendedWeight,
          totalSamples: profile.metrics.totalSamples,
          averageLatencyMs: profile.metrics.averageLatencyMs,
          averageSpreadPoints: profile.metrics.averageSpreadPoints,
          averageSlippagePoints: profile.metrics.averageSlippagePoints,
          averageFillQualityScore: profile.metrics.averageFillQualityScore,
          averageLiquidityScore: profile.metrics.averageLiquidityScore,
          averageRejectionRiskScore: profile.metrics.averageRejectionRiskScore,
        },
      } satisfies BrokerReputationMemoryItem;
    })
    .sort((a, b) => b.reputationScore - a.reputationScore);
}

function normalizeLongTermWeights(
  memories: BrokerReputationMemoryItem[]
): Record<BrokerId, number> {
  const active = memories.filter((memory) => memory.status !== "BLOCKED");

  const total = active.reduce(
    (sum, memory) => sum + memory.recommendedLongTermWeight,
    0
  );

  if (total <= 0) {
    return {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };
  }

  const capital = active.find((memory) => memory.brokerId === "CAPITAL_COM");
  const ic = active.find((memory) => memory.brokerId === "IC_MARKETS");

  const capitalWeight = capital
    ? round0((capital.recommendedLongTermWeight / total) * 100)
    : 0;

  return {
    CAPITAL_COM: capitalWeight,
    IC_MARKETS: ic ? 100 - capitalWeight : 0,
  };
}

function resolveTopBroker(
  memories: BrokerReputationMemoryItem[]
): BrokerId | "NONE" {
  const top = memories
    .filter((memory) => memory.status !== "BLOCKED")
    .sort((a, b) => b.reputationScore - a.reputationScore)[0];

  return top?.brokerId ?? "NONE";
}

function resolveWeakestBroker(
  memories: BrokerReputationMemoryItem[]
): BrokerId | "NONE" {
  const weakest = memories
    .filter((memory) => memory.status !== "BLOCKED")
    .sort((a, b) => a.reputationScore - b.reputationScore)[0];

  return weakest?.brokerId ?? "NONE";
}

function resolveReportStatus(
  memories: BrokerReputationMemoryItem[]
): BrokerReputationMemoryStatus {
  if (memories.every((memory) => memory.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (memories.some((memory) => memory.status === "TRUSTED")) {
    return "TRUSTED";
  }

  if (memories.some((memory) => memory.status === "WATCHLIST")) {
    return "WATCHLIST";
  }

  if (memories.some((memory) => memory.status === "DEGRADED")) {
    return "DEGRADED";
  }

  return "READY";
}

function buildMemoryNotes(memories: BrokerReputationMemoryItem[]): string[] {
  return memories.map((memory) => {
    return `${memory.brokerName}: reputation ${memory.reputationScore}, grade ${memory.reputationGrade}, long-term weight ${memory.recommendedLongTermWeight}, memory strength ${memory.memoryStrength}.`;
  });
}

export function generateBrokerReputationMemoryReport(): BrokerReputationMemoryReport {
  const reputationMemories = buildReputationMemories();

  return {
    version: VERSION,
    status: resolveReportStatus(reputationMemories),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalBrokers: reputationMemories.length,
    topReputationBroker: resolveTopBroker(reputationMemories),
    weakestReputationBroker: resolveWeakestBroker(reputationMemories),
    reputationMemories,
    longTermRecommendedWeights: normalizeLongTermWeights(reputationMemories),
    summary:
      "Broker Reputation Memory converted autonomous optimization profiles into simulated long-term broker trust and reputation scores.",
    memoryNotes: buildMemoryNotes(reputationMemories),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      memoryMode: "SIMULATED_BROKER_REPUTATION_MEMORY",
    },
    createdAt: new Date().toISOString(),
  };
}
