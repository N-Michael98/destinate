export type StrategySpecies =
  | "TREND"
  | "SCALPING"
  | "SWING"
  | "LIQUIDITY"
  | "INSTITUTIONAL"
  | "MEAN_REVERSION"
  | "BREAKOUT"
  | "HYBRID";

export interface StrategySpeciesEntry {
  strategyName: string;
  species: StrategySpecies;
  confidence: number;
  reason: string;
}

export interface StrategySpeciesClassificationReport {
  version: "V13.7.0";
  status: "READY";

  totalStrategies: number;

  speciesCounts: Record<string, number>;

  entries: StrategySpeciesEntry[];

  summary: string;
  createdAt: string;
}
