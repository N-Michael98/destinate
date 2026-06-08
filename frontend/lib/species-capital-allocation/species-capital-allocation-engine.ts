import {
  CapitalAllocationSpecies,
  SpeciesCapitalAllocationItem,
  SpeciesCapitalAllocationReport,
} from "./species-capital-allocation-types";

const PORTFOLIO_CAPITAL_USD = 100000;

const portfolioWeights: Record<CapitalAllocationSpecies, number> = {
  HYBRID: 39,
  LIQUIDITY: 19,
  TREND: 19,
  INSTITUTIONAL: 19,
  BREAKOUT: 4,
  MEAN_REVERSION: 0,
};

function getCapitalTier(weight: number): SpeciesCapitalAllocationItem["capitalTier"] {
  if (weight >= 30) return "CORE";
  if (weight >= 15) return "MAJOR";
  if (weight > 0) return "TACTICAL";
  return "BLOCKED";
}

function getExecutionPermission(
  weight: number
): SpeciesCapitalAllocationItem["executionPermission"] {
  if (weight >= 15) return "ENABLED";
  if (weight > 0) return "LIMITED";
  return "DISABLED";
}

function getCapitalRole(species: CapitalAllocationSpecies): string {
  const roles: Record<CapitalAllocationSpecies, string> = {
    HYBRID: "Primary capital engine with highest adaptive portfolio responsibility.",
    LIQUIDITY: "Capital protection and liquidity-sensitive deployment layer.",
    TREND: "Directional capital exposure for confirmed trend-following conditions.",
    INSTITUTIONAL: "Institutional confirmation capital layer for high-quality setups.",
    BREAKOUT: "Limited tactical capital for momentum expansion opportunities.",
    MEAN_REVERSION: "No capital assigned until species becomes active again.",
  };

  return roles[species];
}

export function getSpeciesCapitalAllocationReport(): SpeciesCapitalAllocationReport {
  const allocationItems: SpeciesCapitalAllocationItem[] = Object.entries(
    portfolioWeights
  ).map(([species, weight]) => {
    const typedSpecies = species as CapitalAllocationSpecies;
    const allocatedCapitalUsd = Math.round((PORTFOLIO_CAPITAL_USD * weight) / 100);

    return {
      species: typedSpecies,
      portfolioWeight: weight,
      allocatedCapitalUsd,
      capitalTier: getCapitalTier(weight),
      executionPermission: getExecutionPermission(weight),
      capitalRole: getCapitalRole(typedSpecies),
    };
  });

  const totalAllocatedCapitalUsd = allocationItems.reduce(
    (sum, item) => sum + item.allocatedCapitalUsd,
    0
  );

  const dominantCapitalSpecies = allocationItems.reduce((best, current) =>
    current.allocatedCapitalUsd > best.allocatedCapitalUsd ? current : best
  ).species;

  const blockedSpecies = allocationItems
    .filter((item) => item.allocatedCapitalUsd === 0)
    .map((item) => item.species);

  return {
    version: "V14.4.0",
    status: "READY",
    mode: "SIMULATION",
    portfolioCapitalUsd: PORTFOLIO_CAPITAL_USD,
    totalAllocatedCapitalUsd,
    unallocatedCapitalUsd: PORTFOLIO_CAPITAL_USD - totalAllocatedCapitalUsd,
    allocationItems,
    dominantCapitalSpecies,
    blockedSpecies,
    summary:
      "Species portfolio weights have been converted into executable simulated capital allocations.",
  };
}
