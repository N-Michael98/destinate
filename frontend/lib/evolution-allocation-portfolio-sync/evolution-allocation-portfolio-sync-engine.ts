import {
  EvolutionAllocationPortfolioSyncReport,
  PortfolioAllocationSyncItem,
  EvolutionSpecies,
} from "./evolution-allocation-portfolio-sync-types";

const normalizedEvolutionAllocation: Record<EvolutionSpecies, number> = {
  HYBRID: 39,
  LIQUIDITY: 19,
  TREND: 19,
  INSTITUTIONAL: 19,
  BREAKOUT: 4,
  MEAN_REVERSION: 0,
};

function getSyncImpact(weight: number): PortfolioAllocationSyncItem["syncImpact"] {
  if (weight >= 30) return "VERY_HIGH";
  if (weight >= 15) return "HIGH";
  if (weight >= 5) return "MEDIUM";
  if (weight > 0) return "LOW";
  return "BLOCKED";
}

function getPortfolioRole(species: EvolutionSpecies): string {
  const roles: Record<EvolutionSpecies, string> = {
    HYBRID: "Primary adaptive portfolio allocation core.",
    LIQUIDITY: "Liquidity-aware defensive allocation layer.",
    TREND: "Trend-following directional exposure layer.",
    INSTITUTIONAL: "Institutional behavior confirmation layer.",
    BREAKOUT: "Small opportunistic momentum expansion layer.",
    MEAN_REVERSION: "Currently blocked from portfolio weighting.",
  };

  return roles[species];
}

export function getEvolutionAllocationPortfolioSyncReport(): EvolutionAllocationPortfolioSyncReport {
  const syncedItems: PortfolioAllocationSyncItem[] = Object.entries(
    normalizedEvolutionAllocation
  ).map(([species, allocation]) => {
    const typedSpecies = species as EvolutionSpecies;

    return {
      species: typedSpecies,
      evolutionAllocation: allocation,
      portfolioWeight: allocation,
      syncImpact: getSyncImpact(allocation),
      portfolioRole: getPortfolioRole(typedSpecies),
    };
  });

  const totalSyncedAllocation = syncedItems.reduce(
    (sum, item) => sum + item.evolutionAllocation,
    0
  );

  const totalPortfolioWeight = syncedItems.reduce(
    (sum, item) => sum + item.portfolioWeight,
    0
  );

  const dominantPortfolioSpecies = syncedItems.reduce((best, current) =>
    current.portfolioWeight > best.portfolioWeight ? current : best
  ).species;

  const blockedSpecies = syncedItems
    .filter((item) => item.portfolioWeight === 0)
    .map((item) => item.species);

  return {
    version: "V14.3.0",
    status: "READY",
    mode: "SIMULATION",
    source: "EVOLUTION_ALLOCATION",
    target: "PORTFOLIO_BRAIN",
    totalSyncedAllocation,
    totalPortfolioWeight,
    syncedItems,
    dominantPortfolioSpecies,
    blockedSpecies,
    summary:
      "Evolution Allocation has been synchronized into Portfolio Brain compatible portfolio weights.",
  };
}
