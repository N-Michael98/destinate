import { generateDynamicPositionAllocationReport } from "../dynamic-position-allocation";
import { BrokerId } from "../smart-broker-selection";

import {
  BrokerExecutionLearningStatus,
  BrokerExecutionQualityLearningReport,
  BrokerExecutionQualityMemory,
  BrokerExecutionQualitySample,
} from "./broker-execution-quality-learning-types";

const VERSION = "V12.3.0" as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round0(value: number): number {
  return Math.round(value);
}

function getExpectedPrice(symbol: string): number {
  if (symbol === "XAUUSD") return 2365.5;
  if (symbol === "EURUSD") return 1.0845;
  if (symbol === "NAS100") return 18850.25;

  return 100;
}

function getExecutionProfile(
  brokerId: BrokerId,
  symbol: string
): {
  latencyMs: number;
  spreadPoints: number;
  slippagePoints: number;
  fillQualityScore: number;
  liquidityScore: number;
  rejectionRiskScore: number;
} {
  if (brokerId === "IC_MARKETS") {
    if (symbol === "XAUUSD") {
      return {
        latencyMs: 28,
        spreadPoints: 13,
        slippagePoints: 0.4,
        fillQualityScore: 92,
        liquidityScore: 90,
        rejectionRiskScore: 8,
      };
    }

    if (symbol === "EURUSD") {
      return {
        latencyMs: 34,
        spreadPoints: 7,
        slippagePoints: 0.2,
        fillQualityScore: 90,
        liquidityScore: 88,
        rejectionRiskScore: 9,
      };
    }

    return {
      latencyMs: 58,
      spreadPoints: 18,
      slippagePoints: 0.7,
      fillQualityScore: 84,
      liquidityScore: 83,
      rejectionRiskScore: 14,
    };
  }

  if (symbol === "XAUUSD") {
    return {
      latencyMs: 74,
      spreadPoints: 19,
      slippagePoints: 0.9,
      fillQualityScore: 82,
      liquidityScore: 84,
      rejectionRiskScore: 12,
    };
  }

  if (symbol === "EURUSD") {
    return {
      latencyMs: 62,
      spreadPoints: 9,
      slippagePoints: 0.4,
      fillQualityScore: 86,
      liquidityScore: 86,
      rejectionRiskScore: 10,
    };
  }

  return {
    latencyMs: 52,
    spreadPoints: 16,
    slippagePoints: 0.5,
    fillQualityScore: 88,
    liquidityScore: 87,
    rejectionRiskScore: 9,
  };
}

function calculateExecutedPrice(
  expectedPrice: number,
  direction: "LONG" | "SHORT",
  slippagePoints: number,
  symbol: string
): number {
  const pointValue = symbol === "EURUSD" ? 0.0001 : 0.1;
  const slippageValue = slippagePoints * pointValue;

  if (direction === "LONG") {
    return round2(expectedPrice + slippageValue);
  }

  return round2(expectedPrice - slippageValue);
}

function buildQualitySamples(): BrokerExecutionQualitySample[] {
  const allocationReport = generateDynamicPositionAllocationReport();

  return allocationReport.results.flatMap((result) => {
    const expectedPrice = getExpectedPrice(result.symbol);

    return result.allocations.map((allocation) => {
      const profile = getExecutionProfile(allocation.brokerId, result.symbol);

      return {
        id: `quality-${result.queueItemId}-${allocation.brokerId}`,
        brokerId: allocation.brokerId,
        brokerName: allocation.brokerName,
        symbol: result.symbol,
        tradingStyle: result.tradingStyle,
        tradeDirection: result.tradeDirection,
        requestedLots: allocation.lotSize,
        filledLots: allocation.status === "ACTIVE" ? allocation.lotSize : 0,
        expectedPrice,
        executedPrice: calculateExecutedPrice(
          expectedPrice,
          result.tradeDirection,
          profile.slippagePoints,
          result.symbol
        ),
        spreadPoints: profile.spreadPoints,
        slippagePoints: profile.slippagePoints,
        latencyMs: profile.latencyMs,
        fillQualityScore: profile.fillQualityScore,
        liquidityScore: profile.liquidityScore,
        rejectionRiskScore: profile.rejectionRiskScore,
        executionOutcome: allocation.status === "ACTIVE" ? "SIMULATED" : "REJECTED",
        createdAt: new Date().toISOString(),
      };
    });
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateExecutionQualityScore(samples: BrokerExecutionQualitySample[]): number {
  if (samples.length === 0) return 0;

  const latencyScore = Math.max(0, 100 - average(samples.map((s) => s.latencyMs)) / 2);
  const spreadScore = Math.max(0, 100 - average(samples.map((s) => s.spreadPoints)));
  const slippageScore = Math.max(
    0,
    100 - average(samples.map((s) => s.slippagePoints)) * 20
  );
  const fillQualityScore = average(samples.map((s) => s.fillQualityScore));
  const liquidityScore = average(samples.map((s) => s.liquidityScore));
  const rejectionSafetyScore =
    100 - average(samples.map((s) => s.rejectionRiskScore));

  return round0(
    latencyScore * 0.18 +
      spreadScore * 0.16 +
      slippageScore * 0.18 +
      fillQualityScore * 0.2 +
      liquidityScore * 0.16 +
      rejectionSafetyScore * 0.12
  );
}

function getLearningStatus(score: number): BrokerExecutionLearningStatus {
  if (score >= 85) return "READY";
  if (score >= 70) return "LEARNING";
  if (score >= 50) return "DEGRADED";

  return "BLOCKED";
}

function getBrokerStrengths(memory: {
  averageLatencyMs: number;
  averageSpreadPoints: number;
  averageSlippagePoints: number;
  averageFillQualityScore: number;
  averageLiquidityScore: number;
  averageRejectionRiskScore: number;
}): string[] {
  const strengths: string[] = [];

  if (memory.averageLatencyMs <= 45) {
    strengths.push("Fast execution latency.");
  }

  if (memory.averageSpreadPoints <= 10) {
    strengths.push("Competitive spread profile.");
  }

  if (memory.averageSlippagePoints <= 0.5) {
    strengths.push("Low simulated slippage.");
  }

  if (memory.averageFillQualityScore >= 88) {
    strengths.push("Strong fill quality.");
  }

  if (memory.averageLiquidityScore >= 88) {
    strengths.push("Strong liquidity quality.");
  }

  if (memory.averageRejectionRiskScore <= 10) {
    strengths.push("Low rejection risk.");
  }

  return strengths;
}

function getBrokerWeaknesses(memory: {
  averageLatencyMs: number;
  averageSpreadPoints: number;
  averageSlippagePoints: number;
  averageFillQualityScore: number;
  averageLiquidityScore: number;
  averageRejectionRiskScore: number;
}): string[] {
  const weaknesses: string[] = [];

  if (memory.averageLatencyMs > 70) {
    weaknesses.push("Latency needs improvement.");
  }

  if (memory.averageSpreadPoints > 18) {
    weaknesses.push("Spread is elevated.");
  }

  if (memory.averageSlippagePoints > 0.8) {
    weaknesses.push("Slippage is elevated.");
  }

  if (memory.averageFillQualityScore < 82) {
    weaknesses.push("Fill quality below target.");
  }

  if (memory.averageLiquidityScore < 82) {
    weaknesses.push("Liquidity quality below target.");
  }

  if (memory.averageRejectionRiskScore > 15) {
    weaknesses.push("Rejection risk elevated.");
  }

  return weaknesses;
}

function buildBrokerMemory(
  brokerId: BrokerId,
  brokerName: string,
  samples: BrokerExecutionQualitySample[]
): BrokerExecutionQualityMemory {
  const filledSamples = samples.filter(
    (sample) =>
      sample.executionOutcome === "FILLED" ||
      sample.executionOutcome === "SIMULATED"
  ).length;

  const partialFillSamples = samples.filter(
    (sample) => sample.executionOutcome === "PARTIAL_FILL"
  ).length;

  const rejectedSamples = samples.filter(
    (sample) => sample.executionOutcome === "REJECTED"
  ).length;

  const averageLatencyMs = round0(average(samples.map((sample) => sample.latencyMs)));
  const averageSpreadPoints = round2(
    average(samples.map((sample) => sample.spreadPoints))
  );
  const averageSlippagePoints = round2(
    average(samples.map((sample) => sample.slippagePoints))
  );
  const averageFillQualityScore = round0(
    average(samples.map((sample) => sample.fillQualityScore))
  );
  const averageLiquidityScore = round0(
    average(samples.map((sample) => sample.liquidityScore))
  );
  const averageRejectionRiskScore = round0(
    average(samples.map((sample) => sample.rejectionRiskScore))
  );

  const executionQualityScore = calculateExecutionQualityScore(samples);

  const memoryForNotes = {
    averageLatencyMs,
    averageSpreadPoints,
    averageSlippagePoints,
    averageFillQualityScore,
    averageLiquidityScore,
    averageRejectionRiskScore,
  };

  return {
    brokerId,
    brokerName,
    totalSamples: samples.length,
    filledSamples,
    partialFillSamples,
    rejectedSamples,
    averageLatencyMs,
    averageSpreadPoints,
    averageSlippagePoints,
    averageFillQualityScore,
    averageLiquidityScore,
    averageRejectionRiskScore,
    executionQualityScore,
    learningStatus: getLearningStatus(executionQualityScore),
    strengths: getBrokerStrengths(memoryForNotes),
    weaknesses: getBrokerWeaknesses(memoryForNotes),
  };
}

function buildBrokerMemories(
  samples: BrokerExecutionQualitySample[]
): BrokerExecutionQualityMemory[] {
  const brokerIds: BrokerId[] = ["IC_MARKETS", "CAPITAL_COM"];

  return brokerIds
    .map((brokerId) => {
      const brokerSamples = samples.filter((sample) => sample.brokerId === brokerId);
      const brokerName = brokerId === "IC_MARKETS" ? "IC Markets" : "Capital.com";

      return buildBrokerMemory(brokerId, brokerName, brokerSamples);
    })
    .sort((a, b) => b.executionQualityScore - a.executionQualityScore);
}

function resolveReportStatus(
  memories: BrokerExecutionQualityMemory[]
): BrokerExecutionLearningStatus {
  if (memories.every((memory) => memory.learningStatus === "BLOCKED")) {
    return "BLOCKED";
  }

  if (memories.some((memory) => memory.learningStatus === "DEGRADED")) {
    return "DEGRADED";
  }

  if (memories.some((memory) => memory.learningStatus === "LEARNING")) {
    return "LEARNING";
  }

  return "READY";
}

function resolveBestBroker(
  memories: BrokerExecutionQualityMemory[]
): BrokerId | "NONE" {
  const best = memories[0];

  if (!best || best.executionQualityScore <= 0) {
    return "NONE";
  }

  return best.brokerId;
}

function resolveWeakestBroker(
  memories: BrokerExecutionQualityMemory[]
): BrokerId | "NONE" {
  const weakest = [...memories].sort(
    (a, b) => a.executionQualityScore - b.executionQualityScore
  )[0];

  if (!weakest || weakest.executionQualityScore <= 0) {
    return "NONE";
  }

  return weakest.brokerId;
}

function buildLearningNotes(memories: BrokerExecutionQualityMemory[]): string[] {
  return memories.map((memory) => {
    return `${memory.brokerName} execution quality score is ${memory.executionQualityScore} based on ${memory.totalSamples} simulated samples.`;
  });
}

export function generateBrokerExecutionQualityLearningReport(): BrokerExecutionQualityLearningReport {
  const samples = buildQualitySamples();
  const brokerMemories = buildBrokerMemories(samples);

  return {
    version: VERSION,
    status: resolveReportStatus(brokerMemories),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalSamples: samples.length,
    brokerMemories,
    bestBroker: resolveBestBroker(brokerMemories),
    weakestBroker: resolveWeakestBroker(brokerMemories),
    summary:
      "Broker Execution Quality Learning created simulated broker memory from latency, spread, slippage, fill quality, liquidity and rejection-risk samples.",
    learningNotes: buildLearningNotes(brokerMemories),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      learningMode: "SIMULATED_EXECUTION_QUALITY_MEMORY",
    },
    createdAt: new Date().toISOString(),
  };
}
