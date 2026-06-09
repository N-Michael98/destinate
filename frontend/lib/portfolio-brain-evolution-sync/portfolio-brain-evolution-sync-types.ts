export interface EvolutionDecision {
  species: string;
  status: "PROTECTED" | "ACTIVE" | "REDUCED" | "ARCHIVED";
  governanceScore: number;
  reason: string;
}

export interface AutonomousEvolutionPortfolioSignal {
  topStrategy: string;
  championSpecies: string;
  bestMutation: string;
  bestHybrid: string;
  autonomousEvolutionScore: number;
  cycleDecision: string;
  memoryCycles: number;
  averageMemoryScore: number;
  strategyBias: string;
  allocationBias: string;
  riskMode: "EXPAND" | "NORMAL" | "REDUCE" | "PAUSE";
  portfolioAction: string;
}

export interface PortfolioBrainEvolutionSyncReport {
  version: string;
  status: string;

  championSpecies: string;

  protectedSpecies: number;
  activeSpecies: number;
  reducedSpecies: number;
  archivedSpecies: number;

  portfolioBias: string;
  portfolioRiskAdjustment: number;

  autonomousEvolutionSignal: AutonomousEvolutionPortfolioSignal;

  decisions: EvolutionDecision[];

  summary: string;
  createdAt: string;
}
