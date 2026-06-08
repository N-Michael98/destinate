import {
  SpeciesTradeAllocationItem,
  SpeciesTradeAllocationReport,
  TradeAllocationSpecies,
} from "./species-trade-allocation-types";

type SourceSizingItem = {
  species: TradeAllocationSpecies;
  allocatedCapitalUsd: number;
  estimatedPositionSizeUsd: number;
  estimatedLotSize: number;
  executionPermission: "ENABLED" | "LIMITED" | "DISABLED";
};

const sourceSizingItems: SourceSizingItem[] = [
  {
    species: "HYBRID",
    allocatedCapitalUsd: 39000,
    estimatedPositionSizeUsd: 24375,
    estimatedLotSize: 0.244,
    executionPermission: "ENABLED",
  },
  {
    species: "LIQUIDITY",
    allocatedCapitalUsd: 19000,
    estimatedPositionSizeUsd: 8444.44,
    estimatedLotSize: 0.084,
    executionPermission: "ENABLED",
  },
  {
    species: "TREND",
    allocatedCapitalUsd: 19000,
    estimatedPositionSizeUsd: 8142.86,
    estimatedLotSize: 0.081,
    executionPermission: "ENABLED",
  },
  {
    species: "INSTITUTIONAL",
    allocatedCapitalUsd: 19000,
    estimatedPositionSizeUsd: 9500,
    estimatedLotSize: 0.095,
    executionPermission: "ENABLED",
  },
  {
    species: "BREAKOUT",
    allocatedCapitalUsd: 4000,
    estimatedPositionSizeUsd: 555.56,
    estimatedLotSize: 0.006,
    executionPermission: "LIMITED",
  },
  {
    species: "MEAN_REVERSION",
    allocatedCapitalUsd: 0,
    estimatedPositionSizeUsd: 0,
    estimatedLotSize: 0,
    executionPermission: "DISABLED",
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getTradeSlots(
  species: TradeAllocationSpecies,
  executionPermission: SourceSizingItem["executionPermission"]
): number {
  if (executionPermission === "DISABLED") return 0;

  const slots: Record<TradeAllocationSpecies, number> = {
    HYBRID: 4,
    LIQUIDITY: 2,
    TREND: 2,
    INSTITUTIONAL: 2,
    BREAKOUT: 1,
    MEAN_REVERSION: 0,
  };

  return slots[species];
}

function getQueuePriority(
  species: TradeAllocationSpecies,
  executionPermission: SourceSizingItem["executionPermission"]
): SpeciesTradeAllocationItem["queuePriority"] {
  if (executionPermission === "DISABLED") return "BLOCKED";
  if (species === "HYBRID") return "PRIMARY";
  if (species === "LIQUIDITY" || species === "INSTITUTIONAL") return "HIGH";
  if (species === "TREND") return "MEDIUM";
  return "LOW";
}

function getAllocationRole(species: TradeAllocationSpecies): string {
  const roles: Record<TradeAllocationSpecies, string> = {
    HYBRID: "Primary multi-slot trade allocation engine for adaptive execution.",
    LIQUIDITY: "Defensive trade allocation with controlled slot exposure.",
    TREND: "Directional trade allocation for confirmed trend conditions.",
    INSTITUTIONAL: "Institutional-confirmation trade allocation layer.",
    BREAKOUT: "Single tactical slot for limited breakout participation.",
    MEAN_REVERSION: "Trade allocation disabled until species becomes active.",
  };

  return roles[species];
}

export function getSpeciesTradeAllocationReport(): SpeciesTradeAllocationReport {
  const tradeAllocationItems: SpeciesTradeAllocationItem[] = sourceSizingItems.map(
    (item) => {
      const tradeSlots = getTradeSlots(item.species, item.executionPermission);

      return {
        species: item.species,
        allocatedCapitalUsd: item.allocatedCapitalUsd,
        estimatedPositionSizeUsd: item.estimatedPositionSizeUsd,
        estimatedLotSize: item.estimatedLotSize,
        tradeSlots,
        capitalPerTradeUsd:
          tradeSlots > 0 ? round(item.allocatedCapitalUsd / tradeSlots) : 0,
        positionSizePerTradeUsd:
          tradeSlots > 0 ? round(item.estimatedPositionSizeUsd / tradeSlots) : 0,
        lotSizePerTrade:
          tradeSlots > 0 ? round(item.estimatedLotSize / tradeSlots, 3) : 0,
        executionPermission: item.executionPermission,
        queuePriority: getQueuePriority(item.species, item.executionPermission),
        allocationRole: getAllocationRole(item.species),
      };
    }
  );

  const totalTradeSlots = tradeAllocationItems.reduce(
    (sum, item) => sum + item.tradeSlots,
    0
  );

  const activeTradeSlots = tradeAllocationItems
    .filter((item) => item.executionPermission !== "DISABLED")
    .reduce((sum, item) => sum + item.tradeSlots, 0);

  const totalAllocatedCapitalUsd = tradeAllocationItems.reduce(
    (sum, item) => sum + item.allocatedCapitalUsd,
    0
  );

  const totalEstimatedPositionSizeUsd = round(
    tradeAllocationItems.reduce(
      (sum, item) => sum + item.estimatedPositionSizeUsd,
      0
    )
  );

  const totalEstimatedLotSize = round(
    tradeAllocationItems.reduce((sum, item) => sum + item.estimatedLotSize, 0),
    3
  );

  const primaryTradeSpecies = tradeAllocationItems.reduce((best, current) =>
    current.tradeSlots > best.tradeSlots ? current : best
  ).species;

  const blockedSpecies = tradeAllocationItems
    .filter((item) => item.executionPermission === "DISABLED")
    .map((item) => item.species);

  return {
    version: "V14.6.0",
    status: "READY",
    mode: "SIMULATION",
    baseSymbol: "XAUUSD",
    totalTradeSlots,
    activeTradeSlots,
    totalAllocatedCapitalUsd,
    totalEstimatedPositionSizeUsd,
    totalEstimatedLotSize,
    tradeAllocationItems,
    primaryTradeSpecies,
    blockedSpecies,
    summary:
      "Species position sizes have been converted into trade slots, per-trade capital, and execution queue priorities.",
  };
}
