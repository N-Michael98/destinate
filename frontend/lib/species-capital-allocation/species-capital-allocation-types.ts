export type SpeciesCapitalAllocationStatus = "READY";

export type CapitalAllocationSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type SpeciesCapitalAllocationItem = {
  species: CapitalAllocationSpecies;
  portfolioWeight: number;
  allocatedCapitalUsd: number;
  capitalTier: "CORE" | "MAJOR" | "TACTICAL" | "BLOCKED";
  executionPermission: "ENABLED" | "LIMITED" | "DISABLED";
  capitalRole: string;
};

export type SpeciesCapitalAllocationReport = {
  version: "V14.4.0";
  status: SpeciesCapitalAllocationStatus;
  mode: "SIMULATION";
  portfolioCapitalUsd: number;
  totalAllocatedCapitalUsd: number;
  unallocatedCapitalUsd: number;
  allocationItems: SpeciesCapitalAllocationItem[];
  dominantCapitalSpecies: CapitalAllocationSpecies;
  blockedSpecies: CapitalAllocationSpecies[];
  summary: string;
};
