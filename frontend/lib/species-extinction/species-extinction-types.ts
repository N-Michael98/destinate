export interface SpeciesExtinctionEntry {
  species: string;

  survivalStatus: string;

  survivalScore: number;

  extinctionRisk: number;

  action:
    | "PROTECTED"
    | "MONITOR"
    | "REDUCE"
    | "ARCHIVE";

  reason: string;
}

export interface SpeciesExtinctionReport {
  version: "V13.9.0";

  status: "READY";

  totalSpecies: number;

  archivedCandidates: number;

  extinctionThreats: number;

  entries: SpeciesExtinctionEntry[];

  summary: string;

  createdAt: string;
}
