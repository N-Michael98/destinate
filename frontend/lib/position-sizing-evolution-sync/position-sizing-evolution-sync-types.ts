export type PositionSizingEvolutionMode =
  | "EXPAND_SIZE"
  | "NORMAL_SIZE"
  | "REDUCE_SIZE"
  | "MINIMUM_SIZE";

export type PositionSizingEvolutionSyncReport = {
  version: "V16.2.8";
  status: "READY";
  mode: "SIMULATION";

  sourcePortfolioVersion: string;
  championSpecies: string;
  topStrategy: string;
  topAdjustedStrategy: string;
  weakestAdjustedStrategy: string;

  adjustedAutonomousEvolutionScore: number;
  adjustedCycleDecision: string;
  autonomousRiskBias: "EXPAND" | "NORMAL" | "DEFENSIVE" | "PAUSE";
  riskMode: "EXPAND" | "NORMAL" | "REDUCE" | "PAUSE";
  portfolioRiskAdjustment: number;
  mutationPressureMode: "LOW" | "NORMAL" | "HIGH" | "EXTREME";

  allocationMultiplier: number;
  adjustedRiskPercentMultiplier: number;
  maxPositionMultiplier: number;
  evolutionPositionSizeScore: number;
  positionSizingMode: PositionSizingEvolutionMode;

  liveExecutionEnabled: false;
  orderExecutionEnabled: false;

  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
