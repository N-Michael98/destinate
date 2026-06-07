import { generateBrokerReputationMemoryReport } from "../broker-reputation-memory";
import { BrokerId } from "../smart-broker-selection";

import {
  BrokerDecayRisk,
  BrokerEvolutionIntelligenceReport,
  BrokerEvolutionProfile,
  BrokerEvolutionSnapshot,
  BrokerEvolutionStatus,
  BrokerEvolutionTrend,
} from "./broker-evolution-intelligence-types";

const VERSION = "V12.7.0" as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function buildSyntheticSnapshots(params: {
  brokerId: BrokerId;
  currentReputationScore: number;
  currentLongTermWeight: number;
  memoryStrength: number;
  executionTrustScore: number;
  optimizationTrustScore: number;
}): BrokerEvolutionSnapshot[] {
  const current = params.currentReputationScore;

  const pattern =
    params.brokerId === "IC_MARKETS"
      ? [-7, -4, 0]
      : [7, 3, 0];

  return [
    {
      label: "T-2",
      reputationScore: clamp(current + pattern[0], 0, 100),
      trustScore: clamp(
        round0((params.executionTrustScore + params.optimizationTrustScore) / 2 + pattern[0]),
        0,
        100
      ),
      recommendedWeight: clamp(params.currentLongTermWeight + Math.round(pattern[0] / 2), 0, 100),
      memoryStrength: clamp(params.memoryStrength + Math.round(pattern[0] / 2), 0, 100),
    },
    {
      label: "T-1",
      reputationScore: clamp(current + pattern[1], 0, 100),
      trustScore: clamp(
        round0((params.executionTrustScore + params.optimizationTrustScore) / 2 + pattern[1]),
        0,
        100
      ),
      recommendedWeight: clamp(params.currentLongTermWeight + Math.round(pattern[1] / 2), 0, 100),
      memoryStrength: clamp(params.memoryStrength + Math.round(pattern[1] / 2), 0, 100),
    },
    {
      label: "T",
      reputationScore: current,
      trustScore: clamp(
        round0((params.executionTrustScore + params.optimizationTrustScore) / 2),
        0,
        100
      ),
      recommendedWeight: params.currentLongTermWeight,
      memoryStrength: params.memoryStrength,
    },
  ];
}

function calculateGrowthRate(snapshots: BrokerEvolutionSnapshot[]): number {
  if (snapshots.length < 2) return 0;

  const first = snapshots[0].reputationScore;
  const last = snapshots[snapshots.length - 1].reputationScore;
  const steps = snapshots.length - 1;

  return round0((last - first) / steps);
}

function resolveTrend(growthRate: number): BrokerEvolutionTrend {
  if (growthRate >= 3) return "IMPROVING";
  if (growthRate <= -3) return "DECLINING";
  return "STABLE";
}

function calculateStabilityScore(snapshots: BrokerEvolutionSnapshot[]): number {
  if (snapshots.length === 0) return 0;

  const values = snapshots.map((snapshot) => snapshot.reputationScore);
  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const volatility =
    values.reduce((sum, value) => sum + Math.abs(value - average), 0) /
    values.length;

  return clamp(round0(100 - volatility * 4), 0, 100);
}

function calculateEvolutionScore(params: {
  currentReputationScore: number;
  growthRate: number;
  stabilityScore: number;
  memoryStrength: number;
  optimizationConfidence: number;
}): number {
  return clamp(
    round0(
      params.currentReputationScore * 0.35 +
        clamp(50 + params.growthRate * 8, 0, 100) * 0.25 +
        params.stabilityScore * 0.15 +
        params.memoryStrength * 0.15 +
        params.optimizationConfidence * 0.1
    ),
    0,
    100
  );
}

function resolveDecayRisk(params: {
  trend: BrokerEvolutionTrend;
  growthRate: number;
  currentReputationScore: number;
  stabilityScore: number;
}): BrokerDecayRisk {
  if (params.currentReputationScore < 55 || params.growthRate <= -8) {
    return "CRITICAL";
  }

  if (params.trend === "DECLINING" && params.stabilityScore < 75) {
    return "HIGH";
  }

  if (params.trend === "DECLINING") {
    return "MEDIUM";
  }

  if (params.currentReputationScore >= 85 && params.trend === "IMPROVING") {
    return "LOW";
  }

  return "LOW";
}

function calculateFutureTrustProjection(params: {
  currentReputationScore: number;
  growthRate: number;
  stabilityScore: number;
  memoryStrength: number;
}): number {
  const projection =
    params.currentReputationScore +
    params.growthRate * 1.5 +
    (params.stabilityScore - 75) * 0.08 +
    (params.memoryStrength - 75) * 0.08;

  return clamp(round0(projection), 0, 100);
}

function calculateFutureWeightProjection(params: {
  currentLongTermWeight: number;
  futureTrustProjection: number;
  evolutionScore: number;
}): number {
  const raw =
    params.currentLongTermWeight * 0.5 +
    params.futureTrustProjection * 0.3 +
    params.evolutionScore * 0.2;

  return clamp(round0(raw), 0, 100);
}

function calculateConfidenceScore(params: {
  memoryStrength: number;
  stabilityScore: number;
  optimizationConfidence: number;
}): number {
  return clamp(
    round0(
      params.memoryStrength * 0.4 +
        params.stabilityScore * 0.3 +
        params.optimizationConfidence * 0.3
    ),
    0,
    100
  );
}

function resolveProfileStatus(params: {
  trend: BrokerEvolutionTrend;
  decayRisk: BrokerDecayRisk;
  evolutionScore: number;
}): BrokerEvolutionStatus {
  if (params.decayRisk === "CRITICAL") return "HIGH_RISK";
  if (params.evolutionScore < 45) return "BLOCKED";
  if (params.trend === "IMPROVING") return "IMPROVING";
  if (params.trend === "DECLINING") return "DECLINING";
  return "STABLE";
}

function buildReasons(params: {
  brokerName: string;
  trend: BrokerEvolutionTrend;
  growthRate: number;
  evolutionScore: number;
  futureTrustProjection: number;
  decayRisk: BrokerDecayRisk;
}): string[] {
  const reasons: string[] = [];

  reasons.push(
    `${params.brokerName} evolution trend is ${params.trend} with growth rate ${params.growthRate}.`
  );

  reasons.push(
    `Evolution score is ${params.evolutionScore}, future trust projection is ${params.futureTrustProjection}.`
  );

  reasons.push(`Decay risk resolved as ${params.decayRisk}.`);

  if (params.trend === "IMPROVING") {
    reasons.push("Broker reputation is improving across simulated memory snapshots.");
  }

  if (params.trend === "DECLINING") {
    reasons.push("Broker reputation is declining and should be monitored before increasing allocation.");
  }

  if (params.trend === "STABLE") {
    reasons.push("Broker reputation is stable under current simulated memory conditions.");
  }

  return reasons;
}

function buildEvolutionProfiles(): BrokerEvolutionProfile[] {
  const reputationReport = generateBrokerReputationMemoryReport();

  return reputationReport.reputationMemories
    .map((memory) => {
      const snapshots = buildSyntheticSnapshots({
        brokerId: memory.brokerId,
        currentReputationScore: memory.reputationScore,
        currentLongTermWeight: reputationReport.longTermRecommendedWeights[memory.brokerId] ?? 0,
        memoryStrength: memory.memoryStrength,
        executionTrustScore: memory.executionTrustScore,
        optimizationTrustScore: memory.optimizationTrustScore,
      });

      const growthRate = calculateGrowthRate(snapshots);
      const evolutionTrend = resolveTrend(growthRate);
      const stabilityScore = calculateStabilityScore(snapshots);

      const evolutionScore = calculateEvolutionScore({
        currentReputationScore: memory.reputationScore,
        growthRate,
        stabilityScore,
        memoryStrength: memory.memoryStrength,
        optimizationConfidence: memory.memorySignals.optimizationConfidence,
      });

      const decayRisk = resolveDecayRisk({
        trend: evolutionTrend,
        growthRate,
        currentReputationScore: memory.reputationScore,
        stabilityScore,
      });

      const futureTrustProjection = calculateFutureTrustProjection({
        currentReputationScore: memory.reputationScore,
        growthRate,
        stabilityScore,
        memoryStrength: memory.memoryStrength,
      });

      const futureWeightProjection = calculateFutureWeightProjection({
        currentLongTermWeight:
          reputationReport.longTermRecommendedWeights[memory.brokerId] ?? 0,
        futureTrustProjection,
        evolutionScore,
      });

      const confidenceScore = calculateConfidenceScore({
        memoryStrength: memory.memoryStrength,
        stabilityScore,
        optimizationConfidence: memory.memorySignals.optimizationConfidence,
      });

      const status = resolveProfileStatus({
        trend: evolutionTrend,
        decayRisk,
        evolutionScore,
      });

      return {
        brokerId: memory.brokerId,
        brokerName: memory.brokerName,
        currentReputationScore: memory.reputationScore,
        currentGrade: memory.reputationGrade,
        currentStatus: memory.status,
        evolutionTrend,
        evolutionScore,
        growthRate,
        decayRisk,
        futureTrustProjection,
        futureWeightProjection,
        stabilityScore,
        confidenceScore,
        status,
        snapshots,
        reasons: buildReasons({
          brokerName: memory.brokerName,
          trend: evolutionTrend,
          growthRate,
          evolutionScore,
          futureTrustProjection,
          decayRisk,
        }),
        signals: {
          executionTrustScore: memory.executionTrustScore,
          reliabilityTrustScore: memory.reliabilityTrustScore,
          optimizationTrustScore: memory.optimizationTrustScore,
          allocationTrustScore: memory.allocationTrustScore,
          memoryStrength: memory.memoryStrength,
          currentLongTermWeight:
            reputationReport.longTermRecommendedWeights[memory.brokerId] ?? 0,
          executionQualityScore: memory.memorySignals.executionQualityScore,
          trendScore: memory.memorySignals.trendScore,
          reliabilityScore: memory.memorySignals.reliabilityScore,
          optimizationConfidence: memory.memorySignals.optimizationConfidence,
        },
      } satisfies BrokerEvolutionProfile;
    })
    .sort((a, b) => b.evolutionScore - a.evolutionScore);
}

function normalizeFutureWeights(
  profiles: BrokerEvolutionProfile[]
): Record<BrokerId, number> {
  const active = profiles.filter((profile) => profile.status !== "BLOCKED");

  const total = active.reduce(
    (sum, profile) => sum + profile.futureWeightProjection,
    0
  );

  if (total <= 0) {
    return {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };
  }

  const capital = active.find((profile) => profile.brokerId === "CAPITAL_COM");
  const ic = active.find((profile) => profile.brokerId === "IC_MARKETS");

  const capitalWeight = capital
    ? round0((capital.futureWeightProjection / total) * 100)
    : 0;

  return {
    CAPITAL_COM: capitalWeight,
    IC_MARKETS: ic ? 100 - capitalWeight : 0,
  };
}

function resolveReportStatus(
  profiles: BrokerEvolutionProfile[]
): BrokerEvolutionStatus {
  if (profiles.every((profile) => profile.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (profiles.some((profile) => profile.status === "HIGH_RISK")) {
    return "HIGH_RISK";
  }

  if (profiles.some((profile) => profile.status === "DECLINING")) {
    return "DECLINING";
  }

  if (profiles.some((profile) => profile.status === "IMPROVING")) {
    return "IMPROVING";
  }

  return "READY";
}

function resolveStrongestBroker(
  profiles: BrokerEvolutionProfile[]
): BrokerId | "NONE" {
  const strongest = profiles
    .filter((profile) => profile.status !== "BLOCKED")
    .sort((a, b) => b.evolutionScore - a.evolutionScore)[0];

  return strongest?.brokerId ?? "NONE";
}

function resolveWeakestBroker(
  profiles: BrokerEvolutionProfile[]
): BrokerId | "NONE" {
  const weakest = profiles
    .filter((profile) => profile.status !== "BLOCKED")
    .sort((a, b) => a.evolutionScore - b.evolutionScore)[0];

  return weakest?.brokerId ?? "NONE";
}

function buildEvolutionNotes(profiles: BrokerEvolutionProfile[]): string[] {
  return profiles.map((profile) => {
    return `${profile.brokerName}: trend ${profile.evolutionTrend}, growth ${profile.growthRate}, evolution score ${profile.evolutionScore}, future trust ${profile.futureTrustProjection}.`;
  });
}

export function generateBrokerEvolutionIntelligenceReport(): BrokerEvolutionIntelligenceReport {
  const evolutionProfiles = buildEvolutionProfiles();

  return {
    version: VERSION,
    status: resolveReportStatus(evolutionProfiles),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalBrokers: evolutionProfiles.length,
    strongestEvolutionBroker: resolveStrongestBroker(evolutionProfiles),
    weakestEvolutionBroker: resolveWeakestBroker(evolutionProfiles),
    improvingBrokers: evolutionProfiles.filter(
      (profile) => profile.evolutionTrend === "IMPROVING"
    ).length,
    stableBrokers: evolutionProfiles.filter(
      (profile) => profile.evolutionTrend === "STABLE"
    ).length,
    decliningBrokers: evolutionProfiles.filter(
      (profile) => profile.evolutionTrend === "DECLINING"
    ).length,
    highRiskBrokers: evolutionProfiles.filter(
      (profile) => profile.status === "HIGH_RISK"
    ).length,
    evolutionProfiles,
    futureRecommendedWeights: normalizeFutureWeights(evolutionProfiles),
    summary:
      "Broker Evolution Intelligence converted broker reputation memory into simulated evolution trends, growth rates, decay risks and future trust projections.",
    evolutionNotes: buildEvolutionNotes(evolutionProfiles),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      evolutionMode: "SIMULATED_BROKER_EVOLUTION_INTELLIGENCE",
    },
    createdAt: new Date().toISOString(),
  };
}
