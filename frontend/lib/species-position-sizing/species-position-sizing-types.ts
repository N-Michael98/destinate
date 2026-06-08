export type SpeciesPositionSizingStatus = "READY";

export type PositionSizingSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type SpeciesPositionSizingItem = {
  species: PositionSizingSpecies;
  allocatedCapitalUsd: number;
  riskPercent: number;
  riskAmountUsd: number;
  stopLossDistancePercent: number;
  estimatedPositionSizeUsd: number;
  estimatedLotSize: number;
  executionPermission: "ENABLED" | "LIMITED" | "DISABLED";
  sizingTier: "CORE_SIZE" | "MAJOR_SIZE" | "TACTICAL_SIZE" | "BLOCKED";
  sizingRole: string;
};

export type SpeciesPositionSizingReport = {
  version: "V14.5.0";
  status: SpeciesPositionSizingStatus;
  mode: "SIMULATION";
  baseSymbol: "XAUUSD";
  totalAllocatedCapitalUsd: number;
  totalRiskAmountUsd: number;
  totalEstimatedPositionSizeUsd: number;
  sizingItems: SpeciesPositionSizingItem[];
  largestPositionSpecies: PositionSizingSpecies;
  blockedSpecies: PositionSizingSpecies[];
  summary: string;
};
