export interface EvolutionDecision {
  species: string;
  status: "PROTECTED" | "ACTIVE" | "REDUCED" | "ARCHIVED";
  governanceScore: number;
  reason: string;
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

  decisions: EvolutionDecision[];

  summary: string;
  createdAt: string;
}
