export type MutationCompetitionStatus =
  | "CHAMPION"
  | "CONTENDER"
  | "AVERAGE"
  | "ELIMINATED";

export interface MutationCompetitionEntry {
  mutationId: string;
  strategyName: string;
  mutationType: string;

  mutationScore: number;
  projectedImprovement: number;
  riskImpact: number;

  competitionScore: number;
  rank: number;

  status: MutationCompetitionStatus;
}

export interface MutationCompetitionReport {
  version: "V13.5.0";
  status: "READY";

  totalCompetitors: number;

  championCount: number;
  contenderCount: number;
  averageCount: number;
  eliminatedCount: number;

  championMutation: string;

  entries: MutationCompetitionEntry[];

  summary: string;
  createdAt: string;
}
