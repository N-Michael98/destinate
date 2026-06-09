export type AutonomousTradingEvolutionCycleStatus =
  | "READY"
  | "NEEDS_REVIEW"
  | "BLOCKED";

export type AutonomousTradingEvolutionDecision = {
  key: string;
  title: string;
  status: "APPROVED" | "WATCHLIST" | "REVIEW" | "BLOCKED";
  score: number;
  reason: string;
};

export type AutonomousTradingEvolutionReport = {
  version: "V16.0.0";
  status: AutonomousTradingEvolutionCycleStatus;
  cycleId: string;
  rankingVersion: string;
  mutationVersion: string;
  breedingVersion: string;
  survivalVersion: string;
  governanceVersion: string;
  totalRankedStrategies: number;
  totalMutations: number;
  totalHybrids: number;
  totalSpecies: number;
  championSpecies: string;
  topStrategy: string;
  bestMutation: string;
  bestHybrid: string;
  autonomousEvolutionScore: number;
  cycleDecision: "CONTINUE_EVOLUTION" | "REDUCE_RISK" | "PAUSE_EVOLUTION";
  decisions: AutonomousTradingEvolutionDecision[];
  summary: string;
  createdAt: string;
};
