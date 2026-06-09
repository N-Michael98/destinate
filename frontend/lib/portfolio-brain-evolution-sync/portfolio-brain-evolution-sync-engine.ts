import { generateEvolutionGovernanceReport } from "../evolution-governance";
import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";
import { buildAutonomousTradingEvolutionMemoryReport } from "@/lib/autonomous-trading-evolution-memory";

import {
  AutonomousEvolutionPortfolioSignal,
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
  autonomousEvolutionScore: number;
  cycleDecision: string;
}): number {
  const governanceAdjustment =
    params.protectedSpecies * 4 -
    params.reducedSpecies * 5 -
    params.archivedSpecies * 8;

  const autonomousAdjustment =
    params.cycleDecision === "CONTINUE_EVOLUTION"
      ? 8
      : params.cycleDecision === "REDUCE_RISK"
        ? -10
        : -25;

  const scoreAdjustment =
    params.autonomousEvolutionScore >= 75
      ? 8
      : params.autonomousEvolutionScore >= 60
        ? 3
        : -12;

  return Math.max(
    -35,
    Math.min(35, governanceAdjustment + autonomousAdjustment + scoreAdjustment)
  );
}

function resolveRiskMode(params: {
  cycleDecision: string;
  autonomousEvolutionScore: number;
}): AutonomousEvolutionPortfolioSignal["riskMode"] {
  if (params.cycleDecision === "PAUSE_EVOLUTION") return "PAUSE";
  if (params.cycleDecision === "REDUCE_RISK") return "REDUCE";
  if (params.autonomousEvolutionScore >= 75) return "EXPAND";
  return "NORMAL";
}

function resolveStrategyBias(params: {
  topStrategy: string;
  bestMutation: string;
  bestHybrid: string;
  cycleDecision: string;
}) {
  if (params.cycleDecision === "PAUSE_EVOLUTION") {
    return "Do not increase strategy allocation. Keep autonomous evolution on review.";
  }

  if (params.cycleDecision === "REDUCE_RISK") {
    return `Reduce exposure while monitoring ${params.topStrategy}.`;
  }

  return `Favor ${params.topStrategy}, monitor ${params.bestMutation}, and preserve hybrid candidate ${params.bestHybrid}.`;
}

function resolveAllocationBias(params: {
  championSpecies: string;
  riskMode: AutonomousEvolutionPortfolioSignal["riskMode"];
}) {
  if (params.riskMode === "PAUSE") {
    return "Freeze new allocation changes until autonomous evolution recovers.";
  }

  if (params.riskMode === "REDUCE") {
    return `Reduce allocation expansion even though ${params.championSpecies} remains the leading species.`;
  }

  if (params.riskMode === "EXPAND") {
    return `Allow controlled allocation expansion toward ${params.championSpecies} species.`;
  }

  return `Keep allocation neutral while favoring ${params.championSpecies} species.`;
}

function resolvePortfolioAction(params: {
  riskMode: AutonomousEvolutionPortfolioSignal["riskMode"];
  topStrategy: string;
  championSpecies: string;
}) {
  if (params.riskMode === "PAUSE") {
    return "PAUSE_AUTONOMOUS_EVOLUTION_ALLOCATION";
  }

  if (params.riskMode === "REDUCE") {
    return "REDUCE_PORTFOLIO_EVOLUTION_RISK";
  }

  if (params.riskMode === "EXPAND") {
    return `EXPAND_${params.championSpecies}_ALLOCATION_WITH_${params.topStrategy}`;
  }

  return `MAINTAIN_${params.championSpecies}_BIAS_WITH_${params.topStrategy}`;
}

function buildAutonomousEvolutionSignal(): AutonomousEvolutionPortfolioSignal {
  const autonomousEvolution = generateAutonomousTradingEvolutionReport();
  const memory = buildAutonomousTradingEvolutionMemoryReport();

  const riskMode = resolveRiskMode({
    cycleDecision: autonomousEvolution.cycleDecision,
    autonomousEvolutionScore: autonomousEvolution.autonomousEvolutionScore,
  });

  return {
    topStrategy: autonomousEvolution.topStrategy,
    championSpecies: autonomousEvolution.championSpecies,
    bestMutation: autonomousEvolution.bestMutation,
    bestHybrid: autonomousEvolution.bestHybrid,
    autonomousEvolutionScore: autonomousEvolution.autonomousEvolutionScore,
    cycleDecision: autonomousEvolution.cycleDecision,
    memoryCycles: memory.stats.totalMemories,
    averageMemoryScore: memory.stats.averageEvolutionScore,
    strategyBias: resolveStrategyBias({
      topStrategy: autonomousEvolution.topStrategy,
      bestMutation: autonomousEvolution.bestMutation,
      bestHybrid: autonomousEvolution.bestHybrid,
      cycleDecision: autonomousEvolution.cycleDecision,
    }),
    allocationBias: resolveAllocationBias({
      championSpecies: autonomousEvolution.championSpecies,
      riskMode,
    }),
    riskMode,
    portfolioAction: resolvePortfolioAction({
      riskMode,
      topStrategy: autonomousEvolution.topStrategy,
      championSpecies: autonomousEvolution.championSpecies,
    }),
  };
}

export function generatePortfolioBrainEvolutionSyncReport(): PortfolioBrainEvolutionSyncReport {
  const governance = generateEvolutionGovernanceReport();
  const autonomousEvolutionSignal = buildAutonomousEvolutionSignal();

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
    version: "V16.0.5",
    status: "READY",

    championSpecies: autonomousEvolutionSignal.championSpecies,

    protectedSpecies,
    activeSpecies,
    reducedSpecies,
    archivedSpecies,

    portfolioBias: resolvePortfolioBias(autonomousEvolutionSignal.championSpecies),

    portfolioRiskAdjustment: resolveRiskAdjustment({
      protectedSpecies,
      reducedSpecies,
      archivedSpecies,
      autonomousEvolutionScore:
        autonomousEvolutionSignal.autonomousEvolutionScore,
      cycleDecision: autonomousEvolutionSignal.cycleDecision,
    }),

    autonomousEvolutionSignal,

    decisions,

    summary:
      "Portfolio Brain Evolution Sync now connects Autonomous Trading Evolution, memory statistics and Evolution Governance into Portfolio Brain allocation and risk bias.",

    createdAt: new Date().toISOString(),
  };
}
