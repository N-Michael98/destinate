export interface EvolutionAllocationEntry {
  species: string;
  governanceStatus: string;
  governanceScore: number;

  targetAllocation: number;
  currentAllocation: number;

  allocationAdjustment: number;

  reason: string;
}

export interface EvolutionAllocationReport {
  version: string;
  status: string;

  championSpecies: string;

  totalAllocation: number;

  entries: EvolutionAllocationEntry[];

  summary: string;

  createdAt: string;
}