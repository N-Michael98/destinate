import {
  BrokerId,
  BrokerSelectionInput,
  BrokerSelectionScore,
  BrokerSelectionStatus,
  SmartBrokerSelectionReport,
  TradingStyle,
} from "./smart-broker-selection-types";

const VERSION = "V12.1.0" as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateLatencyScore(latencyMs: number): number {
  if (latencyMs <= 20) return 100;
  if (latencyMs <= 50) return 90;
  if (latencyMs <= 100) return 75;
  if (latencyMs <= 200) return 55;
  if (latencyMs <= 350) return 35;
  return 15;
}

function calculateBrokerScore(input: BrokerSelectionInput): BrokerSelectionScore {
  const reasons: string[] = [];
  const latencyScore = calculateLatencyScore(input.latencyMs);

  if (!input.isAvailable) {
    reasons.push("Broker currently unavailable.");
  }

  if (input.healthScore >= 85) {
    reasons.push("Strong broker health.");
  } else if (input.healthScore < 60) {
    reasons.push("Weak broker health detected.");
  }

  if (input.riskScore <= 35) {
    reasons.push("Low broker risk.");
  } else if (input.riskScore >= 70) {
    reasons.push("High broker risk.");
  }

  if (input.latencyMs <= 50) {
    reasons.push("Fast execution latency.");
  } else if (input.latencyMs > 200) {
    reasons.push("Latency is elevated.");
  }

  if (input.spreadScore >= 85) {
    reasons.push("Competitive spread quality.");
  }

  if (input.liquidityScore >= 85) {
    reasons.push("Strong liquidity conditions.");
  }

  if (input.executionQualityScore >= 85) {
    reasons.push("High execution quality.");
  }

  const inverseRiskScore = 100 - input.riskScore;

  const weightedScore =
    input.healthScore * 0.22 +
    inverseRiskScore * 0.16 +
    latencyScore * 0.16 +
    input.spreadScore * 0.14 +
    input.liquidityScore * 0.13 +
    input.executionQualityScore * 0.14 +
    input.leverageScore * 0.05;

  const finalScore = input.isAvailable ? clampScore(weightedScore) : 0;

  let status: BrokerSelectionStatus = "APPROVED";

  if (!input.isAvailable || finalScore < 50 || input.healthScore < 45) {
    status = "BLOCKED";
  } else if (finalScore < 70 || input.healthScore < 70 || input.riskScore > 65) {
    status = "DEGRADED";
  }

  return {
    brokerId: input.brokerId,
    brokerName: input.brokerName,
    finalScore,
    status,
    allocationPercent: 0,
    reasons,
    metrics: {
      healthScore: input.healthScore,
      riskScore: input.riskScore,
      latencyMs: input.latencyMs,
      latencyScore,
      spreadScore: input.spreadScore,
      liquidityScore: input.liquidityScore,
      executionQualityScore: input.executionQualityScore,
      leverageScore: input.leverageScore,
    },
  };
}

function calculateAllocation(
  brokerScores: BrokerSelectionScore[]
): Record<BrokerId, number> {
  const approved = brokerScores.filter((broker) => broker.status !== "BLOCKED");

  if (approved.length === 0) {
    return {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };
  }

  if (approved.length === 1) {
    return {
      CAPITAL_COM: approved[0].brokerId === "CAPITAL_COM" ? 100 : 0,
      IC_MARKETS: approved[0].brokerId === "IC_MARKETS" ? 100 : 0,
    };
  }

  const totalScore = approved.reduce((sum, broker) => sum + broker.finalScore, 0);

  if (totalScore <= 0) {
    return {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };
  }

  const capitalCom = approved.find((broker) => broker.brokerId === "CAPITAL_COM");
  const icMarkets = approved.find((broker) => broker.brokerId === "IC_MARKETS");

  const capitalAllocation = capitalCom
    ? Math.round((capitalCom.finalScore / totalScore) * 100)
    : 0;

  const icAllocation = icMarkets ? 100 - capitalAllocation : 0;

  return {
    CAPITAL_COM: capitalAllocation,
    IC_MARKETS: icAllocation,
  };
}

function resolveSelectedBroker(
  allocation: Record<BrokerId, number>
): BrokerId | "MIXED" | "NONE" {
  if (allocation.CAPITAL_COM === 0 && allocation.IC_MARKETS === 0) {
    return "NONE";
  }

  if (allocation.CAPITAL_COM === 100) {
    return "CAPITAL_COM";
  }

  if (allocation.IC_MARKETS === 100) {
    return "IC_MARKETS";
  }

  return "MIXED";
}

function resolveReportStatus(
  brokerScores: BrokerSelectionScore[]
): BrokerSelectionStatus {
  if (brokerScores.every((broker) => broker.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (brokerScores.some((broker) => broker.status === "DEGRADED")) {
    return "DEGRADED";
  }

  return "READY";
}

function getMockBrokerSelectionInputs(
  tradingStyle: TradingStyle
): BrokerSelectionInput[] {
  const styleBoost = {
    SCALPING: {
      CAPITAL_COM: -4,
      IC_MARKETS: 8,
    },
    DAYTRADING: {
      CAPITAL_COM: 6,
      IC_MARKETS: 2,
    },
    SWING: {
      CAPITAL_COM: 8,
      IC_MARKETS: -2,
    },
  };

  return [
    {
      brokerId: "CAPITAL_COM",
      brokerName: "Capital.com",
      preferredStyles: ["DAYTRADING", "SWING"],
      healthScore: clampScore(87 + styleBoost[tradingStyle].CAPITAL_COM),
      riskScore: 28,
      latencyMs: tradingStyle === "SCALPING" ? 92 : 64,
      spreadScore: tradingStyle === "SCALPING" ? 74 : 86,
      liquidityScore: 84,
      executionQualityScore: 88,
      leverageScore: 78,
      isAvailable: true,
    },
    {
      brokerId: "IC_MARKETS",
      brokerName: "IC Markets",
      preferredStyles: ["SCALPING", "DAYTRADING"],
      healthScore: clampScore(84 + styleBoost[tradingStyle].IC_MARKETS),
      riskScore: 32,
      latencyMs: tradingStyle === "SCALPING" ? 24 : 58,
      spreadScore: tradingStyle === "SCALPING" ? 94 : 83,
      liquidityScore: 89,
      executionQualityScore: 91,
      leverageScore: 86,
      isAvailable: true,
    },
  ];
}

export function generateSmartBrokerSelectionReport(
  tradingStyle: TradingStyle = "SCALPING"
): SmartBrokerSelectionReport {
  const inputs = getMockBrokerSelectionInputs(tradingStyle);

  const brokerScores = inputs
    .map(calculateBrokerScore)
    .sort((a, b) => b.finalScore - a.finalScore);

  const allocation = calculateAllocation(brokerScores);

  const scoredWithAllocation = brokerScores.map((broker) => ({
    ...broker,
    allocationPercent: allocation[broker.brokerId],
  }));

  const selectedBroker = resolveSelectedBroker(allocation);
  const status = resolveReportStatus(scoredWithAllocation);

  return {
    version: VERSION,
    status,
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    selectedBroker,
    tradingStyleContext: tradingStyle,
    totalBrokersChecked: scoredWithAllocation.length,
    brokerScores: scoredWithAllocation,
    recommendedAllocation: allocation,
    summary:
      selectedBroker === "MIXED"
        ? "Smart Broker Selection recommends split execution based on current broker scoring."
        : selectedBroker === "NONE"
          ? "No broker is currently approved for execution."
          : `Smart Broker Selection recommends ${selectedBroker} as the best broker for current conditions.`,
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
    },
    createdAt: new Date().toISOString(),
  };
}