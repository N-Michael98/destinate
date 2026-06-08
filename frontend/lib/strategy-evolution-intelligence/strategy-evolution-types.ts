export type StrategyEvolutionStatus =
  | "EVOLVING"
  | "STABLE"
  | "DECLINING"
  | "BREAKTHROUGH";

export interface StrategyEvolutionEntry {
  strategyId: string;
  strategyName: string;
  market: string;
  symbol: string;

  lifecycleScore: number;
  competitionScore: number;
  confidenceScore: number;

  evolutionScore: number;
  growthRate: number;
  decayRisk: number;
  projectedFutureScore: number;

  evolutionStatus: StrategyEvolutionStatus;

  reason: string;
}

export interface StrategyEvolutionReport {
  version: "V13.3.0";
  status: "READY";

  totalStrategies: number;

  breakthroughStrategies: number;
  evolvingStrategies: number;
  stableStrategies: number;
  decliningStrategies: number;

  strongestEvolution: string;
  weakestEvolution: string;

  entries: StrategyEvolutionEntry[];

  summary: string;
  createdAt: string;
}
