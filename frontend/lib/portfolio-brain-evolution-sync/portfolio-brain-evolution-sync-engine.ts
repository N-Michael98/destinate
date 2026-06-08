import { generateEvolutionGovernanceReport } from "../evolution-governance";

import {
  EvolutionDecision,
  PortfolioBrainEvolutionSyncReport,
} from "./portfolio-brain-evolution-sync-types";

function resolvePortfolioBias(championSpecies: string): string {
  if (championSpecies === "HYBRID") {
    return "Favor hybrid strategies and keep strong liquidity/trend support.";
  }

  return `Favor ${championSpecies} species while monitoring reduced and archived species.`;
}

function resolveRiskAdjustment(params: {
  reducedSpecies: number;
  archivedSpecies: number;
  protectedSpecies: number;
}): number {
  return Math.max(
    -25,
    Math.min(
      25,
      params.protectedSpecies * 4 -
        params.reducedSpecies * 5 -
        params.archivedSpecies * 8
    )
  );
}

export function generatePortfolioBrainEvolutionSyncReport(): PortfolioBrainEvolutionSyncReport {
  const governance = generateEvolutionGovernanceReport();

  const decisions: EvolutionDecision[] = governance.decisions.map((decision) => ({
    species: decision.species,
    status: decision.status,
    governanceScore: decision.governanceScore,
    reason: decision.reason,
  }));

  const protectedSpecies = decisions.filter(
    (decision) => decision.status === "PROTECTED"
  ).length;

  const activeSpecies = decisions.filter(
    (decision) => decision.status === "ACTIVE"
  ).length;

  const reducedSpecies = decisions.filter(
    (decision) => decision.status === "REDUCED"
  ).length;

  const archivedSpecies = decisions.filter(
    (decision) => decision.status === "ARCHIVED"
  ).length;

  return {
    version: "V14.1.0",
    status: "READY",

    championSpecies: governance.championSpecies,

    protectedSpecies,
    activeSpecies,
    reducedSpecies,
    archivedSpecies,

    portfolioBias: resolvePortfolioBias(governance.championSpecies),

    portfolioRiskAdjustment: resolveRiskAdjustment({
      protectedSpecies,
      reducedSpecies,
      archivedSpecies,
    }),

    decisions,

    summary:
      "Portfolio Brain Evolution Sync connects Evolution Governance decisions with Portfolio Brain allocation and risk logic.",

    createdAt: new Date().toISOString(),
  };
}
