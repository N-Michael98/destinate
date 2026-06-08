import {
  PositionSizingSpecies,
  SpeciesPositionSizingItem,
  SpeciesPositionSizingReport,
} from "./species-position-sizing-types";

const capitalBySpecies: Record<PositionSizingSpecies, number> = {
  HYBRID: 39000,
  LIQUIDITY: 19000,
  TREND: 19000,
  INSTITUTIONAL: 19000,
  BREAKOUT: 4000,
  MEAN_REVERSION: 0,
};

const riskPercentBySpecies: Record<PositionSizingSpecies, number> = {
  HYBRID: 0.75,
  LIQUIDITY: 0.4,
  TREND: 0.6,
  INSTITUTIONAL: 0.55,
  BREAKOUT: 0.25,
  MEAN_REVERSION: 0,
};

const stopLossDistancePercentBySpecies: Record<PositionSizingSpecies, number> = {
  HYBRID: 1.2,
  LIQUIDITY: 0.9,
  TREND: 1.4,
  INSTITUTIONAL: 1.1,
  BREAKOUT: 1.8,
  MEAN_REVERSION: 0,
};

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getExecutionPermission(
  species: PositionSizingSpecies,
  allocatedCapitalUsd: number
): SpeciesPositionSizingItem["executionPermission"] {
  if (allocatedCapitalUsd <= 0 || species === "MEAN_REVERSION") return "DISABLED";
  if (species === "BREAKOUT") return "LIMITED";
  return "ENABLED";
}

function getSizingTier(
  allocatedCapitalUsd: number
): SpeciesPositionSizingItem["sizingTier"] {
  if (allocatedCapitalUsd >= 30000) return "CORE_SIZE";
  if (allocatedCapitalUsd >= 10000) return "MAJOR_SIZE";
  if (allocatedCapitalUsd > 0) return "TACTICAL_SIZE";
  return "BLOCKED";
}

function getSizingRole(species: PositionSizingSpecies): string {
  const roles: Record<PositionSizingSpecies, string> = {
    HYBRID: "Primary adaptive sizing engine with the largest controlled exposure.",
    LIQUIDITY: "Defensive sizing profile with reduced risk and liquidity protection.",
    TREND: "Directional trend sizing with moderate risk expansion.",
    INSTITUTIONAL: "Confirmation-based sizing profile for institutional-quality setups.",
    BREAKOUT: "Limited tactical sizing for high-volatility breakout opportunities.",
    MEAN_REVERSION: "Sizing disabled until species receives portfolio capital again.",
  };

  return roles[species];
}

export function getSpeciesPositionSizingReport(): SpeciesPositionSizingReport {
  const sizingItems: SpeciesPositionSizingItem[] = Object.entries(
    capitalBySpecies
  ).map(([species, allocatedCapitalUsd]) => {
    const typedSpecies = species as PositionSizingSpecies;
    const riskPercent = riskPercentBySpecies[typedSpecies];
    const stopLossDistancePercent = stopLossDistancePercentBySpecies[typedSpecies];

    const riskAmountUsd = round((allocatedCapitalUsd * riskPercent) / 100);
    const estimatedPositionSizeUsd =
      stopLossDistancePercent > 0
        ? round(riskAmountUsd / (stopLossDistancePercent / 100))
        : 0;

    const estimatedLotSize = round(estimatedPositionSizeUsd / 100000, 3);

    return {
      species: typedSpecies,
      allocatedCapitalUsd,
      riskPercent,
      riskAmountUsd,
      stopLossDistancePercent,
      estimatedPositionSizeUsd,
      estimatedLotSize,
      executionPermission: getExecutionPermission(
        typedSpecies,
        allocatedCapitalUsd
      ),
      sizingTier: getSizingTier(allocatedCapitalUsd),
      sizingRole: getSizingRole(typedSpecies),
    };
  });

  const totalAllocatedCapitalUsd = sizingItems.reduce(
    (sum, item) => sum + item.allocatedCapitalUsd,
    0
  );

  const totalRiskAmountUsd = round(
    sizingItems.reduce((sum, item) => sum + item.riskAmountUsd, 0)
  );

  const totalEstimatedPositionSizeUsd = round(
    sizingItems.reduce((sum, item) => sum + item.estimatedPositionSizeUsd, 0)
  );

  const largestPositionSpecies = sizingItems.reduce((best, current) =>
    current.estimatedPositionSizeUsd > best.estimatedPositionSizeUsd
      ? current
      : best
  ).species;

  const blockedSpecies = sizingItems
    .filter((item) => item.executionPermission === "DISABLED")
    .map((item) => item.species);

  return {
    version: "V14.5.0",
    status: "READY",
    mode: "SIMULATION",
    baseSymbol: "XAUUSD",
    totalAllocatedCapitalUsd,
    totalRiskAmountUsd,
    totalEstimatedPositionSizeUsd,
    sizingItems,
    largestPositionSpecies,
    blockedSpecies,
    summary:
      "Species capital allocations have been converted into risk-based simulated position sizes.",
  };
}
