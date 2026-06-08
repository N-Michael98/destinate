export type PortfolioSyncStatus = "READY";

export type EvolutionSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type PortfolioAllocationSyncItem = {
  species: EvolutionSpecies;
  evolutionAllocation: number;
  portfolioWeight: number;
  syncImpact: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  portfolioRole: string;
};

export type EvolutionAllocationPortfolioSyncReport = {
  version: "V14.3.0";
  status: PortfolioSyncStatus;
  mode: "SIMULATION";
  source: "EVOLUTION_ALLOCATION";
  target: "PORTFOLIO_BRAIN";
  totalSyncedAllocation: number;
  totalPortfolioWeight: number;
  syncedItems: PortfolioAllocationSyncItem[];
  dominantPortfolioSpecies: EvolutionSpecies;
  blockedSpecies: EvolutionSpecies[];
  summary: string;
};
