export type StrategyStatus =
  | "BOOST"
  | "REDUCE"
  | "HOLD"
  | "DEFENSIVE_HOLD";

export type StrategyWeightInput = {
  id: string;
  strategy: string;
  symbol: string;
  currentWeight: number;
  learningScore: number;
  winRate: number;
  averagePnlPercent: number;
  confidenceScore: number;
  strategyScore: number;
  institutionalConfidenceScore: number;
  institutionalRiskScore: number;
  institutionalStrategyScore: number;
  institutionalBias: "RISK_ON" | "RISK_OFF" | "MIXED" | "NEUTRAL";
};

export type StrategyWeightDecision = {
  id: string;
  strategy: string;
  symbol: string;
  currentWeight: number;
  recommendedWeight: number;
  weightChange: number;
  maxAllowedWeight: number;
  learningScore: number;
  combinedConfidenceScore: number;
  combinedRiskScore: number;
  combinedStrategyScore: number;
  status: StrategyStatus;
  allowWeightIncrease: boolean;
  requireWeightReduction: boolean;
  reason: string;
};

export type StrategyWeightAutoRebalancingReport = {
  version: "V11.8.0";
  status: "READY";
  mode: "SIMULATION";
  totalStrategies: number;
  boostedStrategies: number;
  reducedStrategies: number;
  heldStrategies: number;
  defensiveHeldStrategies: number;
  totalCurrentWeight: number;
  totalRecommendedWeight: number;
  institutionalRiskMode: "NORMAL" | "DEFENSIVE";
  decisions: StrategyWeightDecision[];
  recommendation: string;
  updatedAt: string;
};
