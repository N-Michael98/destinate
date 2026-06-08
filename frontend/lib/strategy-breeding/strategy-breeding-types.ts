export interface StrategyBreedingEntry {
  hybridId: string;

  parentA: string;
  parentB: string;

  hybridName: string;

  parentAScore: number;
  parentBScore: number;

  hybridScore: number;

  expectedImprovement: number;
  breedingConfidence: number;

  breedingReason: string;
}

export interface StrategyBreedingReport {
  version: "V13.6.0";
  status: "READY";

  totalHybrids: number;

  bestHybrid: string;

  entries: StrategyBreedingEntry[];

  summary: string;
  createdAt: string;
}
