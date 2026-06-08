export interface SpeciesSurvivalEntry {
  species: string;

  population: number;

  averageConfidence: number;

  hybridBonus: number;

  survivalScore: number;

  survivalStatus:
    | "DOMINANT"
    | "STABLE"
    | "THREATENED"
    | "ENDANGERED";

  reason: string;
}

export interface SpeciesSurvivalReport {
  version: "V13.8.0";

  status: "READY";

  totalSpecies: number;

  dominantSpecies: string;

  entries: SpeciesSurvivalEntry[];

  summary: string;

  createdAt: string;
}
