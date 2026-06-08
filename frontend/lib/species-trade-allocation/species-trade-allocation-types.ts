export type SpeciesTradeAllocationStatus = "READY";

export type TradeAllocationSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type SpeciesTradeAllocationItem = {
  species: TradeAllocationSpecies;
  allocatedCapitalUsd: number;
  estimatedPositionSizeUsd: number;
  estimatedLotSize: number;
  tradeSlots: number;
  capitalPerTradeUsd: number;
  positionSizePerTradeUsd: number;
  lotSizePerTrade: number;
  executionPermission: "ENABLED" | "LIMITED" | "DISABLED";
  queuePriority: "PRIMARY" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  allocationRole: string;
};

export type SpeciesTradeAllocationReport = {
  version: "V14.6.0";
  status: SpeciesTradeAllocationStatus;
  mode: "SIMULATION";
  baseSymbol: "XAUUSD";
  totalTradeSlots: number;
  activeTradeSlots: number;
  totalAllocatedCapitalUsd: number;
  totalEstimatedPositionSizeUsd: number;
  totalEstimatedLotSize: number;
  tradeAllocationItems: SpeciesTradeAllocationItem[];
  primaryTradeSpecies: TradeAllocationSpecies;
  blockedSpecies: TradeAllocationSpecies[];
  summary: string;
};
