import type {
  StrategyStatus,
  StrategyWeightAutoRebalancingReport,
  StrategyWeightDecision,
  StrategyWeightInput,
} from "./strategy-weight-types";

const strategyInputs: StrategyWeightInput[] = [
  {
    id: "strategy-weight-spx500-trend-continuation",
    strategy: "Trend Continuation Strategy",
    symbol: "SPX500",
    currentWeight: 25,
    learningScore: 80,
    winRate: 100,
    averagePnlPercent: 1.5,
    confidenceScore: 70,
    strategyScore: 65,
    institutionalConfidenceScore: 68,
    institutionalRiskScore: 97,
    institutionalStrategyScore: 60,
    institutionalBias: "RISK_OFF",
  },
  {
    id: "strategy-weight-nas100-trend-continuation",
    strategy: "Trend Continuation Strategy",
    symbol: "NAS100",
    currentWeight: 25,
    learningScore: 80,
    winRate: 100,
    averagePnlPercent: 1.5,
    confidenceScore: 70,
    strategyScore: 65,
    institutionalConfidenceScore: 68,
    institutionalRiskScore: 97,
    institutionalStrategyScore: 60,
    institutionalBias: "RISK_OFF",
  },
  {
    id: "strategy-weight-xauusd-breakout",
    strategy: "Gold Breakout Strategy",
    symbol: "XAUUSD",
    currentWeight: 20,
    learningScore: 55,
    winRate: 55,
    averagePnlPercent: 0.4,
    confidenceScore: 58,
    strategyScore: 56,
    institutionalConfidenceScore: 68,
    institutionalRiskScore: 97,
    institutionalStrategyScore: 60,
    institutionalBias: "RISK_OFF",
  },
  {
    id: "strategy-weight-eurusd-mean-reversion",
    strategy: "EURUSD Mean Reversion Strategy",
    symbol: "EURUSD",
    currentWeight: 15,
    learningScore: 48,
    winRate: 50,
    averagePnlPercent: 0.1,
    confidenceScore: 52,
    strategyScore: 50,
    institutionalConfidenceScore: 68,
    institutionalRiskScore: 97,
    institutionalStrategyScore: 60,
    institutionalBias: "RISK_OFF",
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function resolveStatus(
  combinedStrategyScore: number,
  combinedRiskScore: number,
  institutionalBias: StrategyWeightInput["institutionalBias"],
): StrategyStatus {
  if (combinedRiskScore >= 80 || institutionalBias === "RISK_OFF") {
    if (combinedStrategyScore >= 70) return "DEFENSIVE_HOLD";
    return "REDUCE";
  }

  if (combinedStrategyScore >= 70) return "BOOST";
  if (combinedStrategyScore <= 45) return "REDUCE";
  return "HOLD";
}

function calculateRecommendedWeight(input: StrategyWeightInput): StrategyWeightDecision {
  const combinedConfidenceScore = clamp(
    input.confidenceScore * 0.45 +
      input.institutionalConfidenceScore * 0.25 +
      input.learningScore * 0.3,
  );

  const combinedRiskScore = clamp(
    input.institutionalRiskScore * 0.65 +
      (100 - input.winRate) * 0.2 +
      Math.max(0, 50 - input.learningScore) * 0.15,
  );

  const pnlComponent = clamp(50 + input.averagePnlPercent * 10);

  const combinedStrategyScore = clamp(
    input.strategyScore * 0.3 +
      input.institutionalStrategyScore * 0.2 +
      input.learningScore * 0.35 +
      pnlComponent * 0.15,
  );

  const status = resolveStatus(
    combinedStrategyScore,
    combinedRiskScore,
    input.institutionalBias,
  );

  const maxAllowedWeight =
    combinedRiskScore >= 85 || input.institutionalBias === "RISK_OFF"
      ? 15
      : combinedRiskScore >= 70
        ? 20
        : 35;

  let recommendedWeight = input.currentWeight;

  if (status === "BOOST") {
    recommendedWeight = Math.min(maxAllowedWeight, input.currentWeight + 5);
  }

  if (status === "REDUCE") {
    recommendedWeight = Math.max(5, input.currentWeight - 10);
  }

  if (status === "DEFENSIVE_HOLD") {
    recommendedWeight = Math.min(input.currentWeight, maxAllowedWeight);
  }

  if (status === "HOLD") {
    recommendedWeight = Math.min(input.currentWeight, maxAllowedWeight);
  }

  recommendedWeight = round(recommendedWeight);

  const allowWeightIncrease = status === "BOOST" && recommendedWeight > input.currentWeight;
  const requireWeightReduction = recommendedWeight < input.currentWeight;

  const reason =
    status === "BOOST"
      ? "Strategy has strong learning and acceptable institutional risk. Controlled weight increase allowed."
      : status === "REDUCE"
        ? "Strategy weight must be reduced because risk is elevated or score is weak."
        : status === "DEFENSIVE_HOLD"
          ? "Strategy is performing well, but institutional risk is high. Hold defensively and cap exposure."
          : "Strategy remains stable. Keep current weight within risk limits.";

  return {
    id: input.id,
    strategy: input.strategy,
    symbol: input.symbol,
    currentWeight: input.currentWeight,
    recommendedWeight,
    weightChange: round(recommendedWeight - input.currentWeight),
    maxAllowedWeight,
    learningScore: input.learningScore,
    combinedConfidenceScore: round(combinedConfidenceScore),
    combinedRiskScore: round(combinedRiskScore),
    combinedStrategyScore: round(combinedStrategyScore),
    status,
    allowWeightIncrease,
    requireWeightReduction,
    reason,
  };
}

export function getStrategyWeightAutoRebalancingReport(): StrategyWeightAutoRebalancingReport {
  const decisions = strategyInputs.map(calculateRecommendedWeight);

  const boostedStrategies = decisions.filter((decision) => decision.status === "BOOST").length;
  const reducedStrategies = decisions.filter((decision) => decision.status === "REDUCE").length;
  const defensiveHeldStrategies = decisions.filter(
    (decision) => decision.status === "DEFENSIVE_HOLD",
  ).length;
  const heldStrategies = decisions.filter((decision) => decision.status === "HOLD").length;

  const totalCurrentWeight = round(
    decisions.reduce((sum, decision) => sum + decision.currentWeight, 0),
  );

  const totalRecommendedWeight = round(
    decisions.reduce((sum, decision) => sum + decision.recommendedWeight, 0),
  );

  const institutionalRiskMode = decisions.some(
    (decision) => decision.combinedRiskScore >= 80 || decision.status === "DEFENSIVE_HOLD",
  )
    ? "DEFENSIVE"
    : "NORMAL";

  const recommendation =
    institutionalRiskMode === "DEFENSIVE"
      ? "Strategy weights have been capped because institutional risk is elevated. Keep exposure defensive until risk improves."
      : boostedStrategies > 0
        ? "Some strategies qualify for controlled weight increases based on learning and confidence."
        : "No aggressive rebalance required. Continue collecting learning signals.";

  return {
    version: "V11.8.0",
    status: "READY",
    mode: "SIMULATION",
    totalStrategies: decisions.length,
    boostedStrategies,
    reducedStrategies,
    heldStrategies,
    defensiveHeldStrategies,
    totalCurrentWeight,
    totalRecommendedWeight,
    institutionalRiskMode,
    decisions,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
