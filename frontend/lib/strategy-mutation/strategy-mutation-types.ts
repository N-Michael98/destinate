export type MutationType =
  | "AGGRESSIVE"
  | "CONSERVATIVE"
  | "NEWS_FILTERED"
  | "SESSION_FILTERED"
  | "RISK_REDUCED";

export interface StrategyMutationEntry {
  mutationId: string;
  parentStrategyId: string;
  parentStrategyName: string;

  mutationType: MutationType;

  originalEvolutionScore: number;
  mutationScore: number;

  projectedImprovement: number;
  riskImpact: number;

  mutationReason: string;
}

export interface StrategyMutationReport {
  version: "V13.4.0";
  status: "READY";

  totalParents: number;
  totalMutations: number;

  bestMutation: string;

  entries: StrategyMutationEntry[];

  summary: string;
  createdAt: string;
}
