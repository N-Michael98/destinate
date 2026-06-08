export interface GovernanceDecision {
  species: string;

  status:
    | "ACTIVE"
    | "PROTECTED"
    | "REDUCED"
    | "ARCHIVED";

  governanceScore: number;

  reason: string;
}

export interface EvolutionGovernanceReport {
  version: "V14.0.0";

  status: "READY";

  totalSpecies: number;

  activeSpecies: number;

  protectedSpecies: number;

  reducedSpecies: number;

  archivedSpecies: number;

  championSpecies: string;

  decisions: GovernanceDecision[];

  summary: string;

  createdAt: string;
}
