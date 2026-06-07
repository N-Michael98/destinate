import { generateBrokerExecutionQualityLearningReport } from "../broker-execution-quality-learning";
import { BrokerId } from "../smart-broker-selection";

import {
  AdaptiveBrokerWeightingReport,
  AdaptiveBrokerWeightingStatus,
  BrokerAdaptiveWeight,
} from "./adaptive-broker-weighting-types";

const VERSION = "V12.4.0" as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function getBaseWeight(brokerId: BrokerId): number {
  if (brokerId === "IC_MARKETS") return 50;
  return 50;
}

function calculateAdaptiveAdjustment(executionQualityScore: number): number {
  if (executionQualityScore >= 90) return 10;
  if (executionQualityScore >= 85) return 6;
  if (executionQualityScore >= 80) return 3;
  if (executionQualityScore >= 75) return 0;
  if (executionQualityScore >= 70) return -4;
  if (executionQualityScore >= 60) return -8;

  return -15;
}

function resolveWeightStatus(
  executionQualityScore: number,
  finalWeight: number
): AdaptiveBrokerWeightingStatus {
  if (finalWeight <= 0 || executionQualityScore < 50) {
    return "BLOCKED";
  }

  if (executionQualityScore >= 85) {
    return "ADJUSTED";
  }

  if (executionQualityScore >= 70) {
    return "LEARNING";
  }

  return "BLOCKED";
}

function buildReasons(params: {
  brokerName: string;
  executionQualityScore: number;
  adaptiveAdjustment: number;
  finalWeight: number;
}): string[] {
  const reasons: string[] = [];

  if (params.executionQualityScore >= 85) {
    reasons.push(`${params.brokerName} receives positive weighting due to strong execution quality memory.`);
  }

  if (params.executionQualityScore >= 80 && params.executionQualityScore < 85) {
    reasons.push(`${params.brokerName} remains active with moderate positive learning support.`);
  }

  if (params.executionQualityScore < 75) {
    reasons.push(`${params.brokerName} receives reduced weighting due to weaker execution quality memory.`);
  }

  if (params.adaptiveAdjustment > 0) {
    reasons.push(`Adaptive adjustment increased by +${params.adaptiveAdjustment}.`);
  }

  if (params.adaptiveAdjustment < 0) {
    reasons.push(`Adaptive adjustment reduced by ${params.adaptiveAdjustment}.`);
  }

  reasons.push(`Final simulated broker weight resolved to ${params.finalWeight}.`);

  return reasons;
}

function buildBrokerWeights(): BrokerAdaptiveWeight[] {
  const learningReport = generateBrokerExecutionQualityLearningReport();

  return learningReport.brokerMemories
    .map((memory) => {
      const baseWeight = getBaseWeight(memory.brokerId);
      const adaptiveAdjustment = calculateAdaptiveAdjustment(
        memory.executionQualityScore
      );
      const finalWeight = clamp(baseWeight + adaptiveAdjustment, 0, 100);

      return {
        brokerId: memory.brokerId,
        brokerName: memory.brokerName,
        executionQualityScore: memory.executionQualityScore,
        baseWeight,
        adaptiveAdjustment,
        finalWeight,
        status: resolveWeightStatus(memory.executionQualityScore, finalWeight),
        reasons: buildReasons({
          brokerName: memory.brokerName,
          executionQualityScore: memory.executionQualityScore,
          adaptiveAdjustment,
          finalWeight,
        }),
        metrics: {
          averageLatencyMs: memory.averageLatencyMs,
          averageSpreadPoints: memory.averageSpreadPoints,
          averageSlippagePoints: memory.averageSlippagePoints,
          averageFillQualityScore: memory.averageFillQualityScore,
          averageLiquidityScore: memory.averageLiquidityScore,
          averageRejectionRiskScore: memory.averageRejectionRiskScore,
          totalSamples: memory.totalSamples,
        },
      } satisfies BrokerAdaptiveWeight;
    })
    .sort((a, b) => b.finalWeight - a.finalWeight);
}

function normalizeWeights(
  brokerWeights: BrokerAdaptiveWeight[]
): Record<BrokerId, number> {
  const activeWeights = brokerWeights.filter(
    (broker) => broker.status !== "BLOCKED" && broker.finalWeight > 0
  );

  const totalWeight = activeWeights.reduce(
    (sum, broker) => sum + broker.finalWeight,
    0
  );

  if (totalWeight <= 0) {
    return {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };
  }

  const capitalCom = activeWeights.find(
    (broker) => broker.brokerId === "CAPITAL_COM"
  );
  const icMarkets = activeWeights.find(
    (broker) => broker.brokerId === "IC_MARKETS"
  );

  const capitalWeight = capitalCom
    ? round0((capitalCom.finalWeight / totalWeight) * 100)
    : 0;

  const icWeight = icMarkets ? 100 - capitalWeight : 0;

  return {
    CAPITAL_COM: capitalWeight,
    IC_MARKETS: icWeight,
  };
}

function resolveReportStatus(
  brokerWeights: BrokerAdaptiveWeight[]
): AdaptiveBrokerWeightingStatus {
  if (brokerWeights.every((broker) => broker.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (brokerWeights.some((broker) => broker.status === "ADJUSTED")) {
    return "ADJUSTED";
  }

  return "LEARNING";
}

function resolveBestWeightedBroker(
  brokerWeights: BrokerAdaptiveWeight[]
): BrokerId | "NONE" {
  const best = brokerWeights
    .filter((broker) => broker.status !== "BLOCKED")
    .sort((a, b) => b.finalWeight - a.finalWeight)[0];

  if (!best) return "NONE";

  return best.brokerId;
}

function resolveWeakestWeightedBroker(
  brokerWeights: BrokerAdaptiveWeight[]
): BrokerId | "NONE" {
  const weakest = brokerWeights
    .filter((broker) => broker.status !== "BLOCKED")
    .sort((a, b) => a.finalWeight - b.finalWeight)[0];

  if (!weakest) return "NONE";

  return weakest.brokerId;
}

function buildLearningNotes(brokerWeights: BrokerAdaptiveWeight[]): string[] {
  return brokerWeights.map((broker) => {
    const sign =
      broker.adaptiveAdjustment > 0
        ? "+"
        : broker.adaptiveAdjustment === 0
          ? ""
          : "";

    return `${broker.brokerName}: execution quality ${broker.executionQualityScore}, base weight ${broker.baseWeight}, adaptive adjustment ${sign}${broker.adaptiveAdjustment}, final weight ${broker.finalWeight}.`;
  });
}

export function generateAdaptiveBrokerWeightingReport(): AdaptiveBrokerWeightingReport {
  const brokerWeights = buildBrokerWeights();
  const normalizedWeights = normalizeWeights(brokerWeights);

  return {
    version: VERSION,
    status: resolveReportStatus(brokerWeights),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalBrokers: brokerWeights.length,
    bestWeightedBroker: resolveBestWeightedBroker(brokerWeights),
    weakestWeightedBroker: resolveWeakestWeightedBroker(brokerWeights),
    brokerWeights,
    normalizedWeights,
    summary:
      "Adaptive Broker Weighting converted broker execution quality memory into simulated broker weighting adjustments.",
    learningNotes: buildLearningNotes(brokerWeights),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      weightingMode: "SIMULATED_ADAPTIVE_BROKER_WEIGHTING",
    },
    createdAt: new Date().toISOString(),
  };
}
