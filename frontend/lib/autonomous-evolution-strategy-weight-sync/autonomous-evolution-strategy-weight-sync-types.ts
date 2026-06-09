export type AutonomousEvolutionStrategyWeightDecision = {
  id: string;
  strategy: string;
  symbol: string;
  rank: number;
  baseScore: number;
  evolutionScore: number;
  memoryScore: number;
  baseWeight: number;
  recommendedWeight: number;
  weightChange: number;
  status: "BOOST" | "HOLD" | "REDUCE" | "BLOCK";
  reason: string;
};

export type AutonomousEvolutionStrategyWeightSyncReport = {
  version: "V16.0.6";
  status: "READY";
  mode: "SIMULATION";
  cycleDecision: string;
  topStrategy: string;
  championSpecies: string;
  autonomousEvolutionScore: number;
  averageMemoryScore: number;
  totalStrategies: number;
  boostedStrategies: number;
  reducedStrategies: number;
  heldStrategies: number;
  blockedStrategies: number;
  totalBaseWeight: number;
  totalRecommendedWeight: number;
  decisions: AutonomousEvolutionStrategyWeightDecision[];
  recommendation: string;
  updatedAt: string;
};
