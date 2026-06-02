export type StrategyEvolutionScore = {
  strategy: string;
  evolutionScore: number;
  winRate: number;
  averageReturn: number;
  confidence: number;
};

export type MarketAdaptation = {
  market: string;
  bestStrategy: string;
  score: number;
};

export type EvolutionStatus =
  | "PREPARING"
  | "LEARNING"
  | "ACTIVE";