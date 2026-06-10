import { generateEvolutionGovernanceReport } from "../evolution-governance";
import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";
import { buildAutonomousTradingEvolutionMemoryReport } from "@/lib/autonomous-trading-evolution-memory";
import { generateMultiStyleConsensusUnifiedDecisionSyncReport } from "@/lib/multi-style-consensus-unified-decision-sync";

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

function resolveConsensusPortfolioPriority(mode: string) {
  if (mode === "CONSENSUS_ELITE") return "MAXIMUM";
  if (mode === "CONSENSUS_APPROVED") return "HIGH";
  if (mode === "CONSENSUS_STRICT") return "REDUCED";
  return "ZERO";
}

function resolveConsensusRiskAdjustment(mode: string) {
  if (mode === "CONSENSUS_ELITE") return 10;
  if (mode === "CONSENSUS_APPROVED") return 5;
  if (mode === "CONSENSUS_STRICT") return -10;
  return -25;
}

function resolveConsensusAllocationBias(mode: string) {
  if (mode === "CONSENSUS_ELITE") return "EXPAND_CONSENSUS_ALLOCATION";
  if (mode === "CONSENSUS_APPROVED") return "NORMAL_CONSENSUS_ALLOCATION";
  if (mode === "CONSENSUS_STRICT") return "DEFENSIVE_CONSENSUS_ALLOCATION";
  return "BLOCK_CONSENSUS_ALLOCATION";
}

function buildConsensusPortfolioSignal() {
  const consensus = generateMultiStyleConsensusUnifiedDecisionSyncReport();

  const tradable = consensus.decisions
    .filter((decision) => decision.executionAllowed)
    .sort((a, b) => b.executionPriority - a.executionPriority);

  const best = tradable[0] ?? null;

  const blocked = consensus.decisions.filter(
    (decision) => decision.unifiedDecisionMode === "CONSENSUS_BLOCKED"
  ).length;

  return {
    version: consensus.version,
    totalSymbols: consensus.totalSymbols,
    eliteSymbols: consensus.eliteSymbols,
    approvedSymbols: consensus.approvedSymbols,
    strictSymbols: consensus.strictSymbols,
    blockedSymbols: blocked,
    dualBrokerCheckSymbols: consensus.dualBrokerCheckSymbols,
    singleBrokerCheckSymbols: consensus.singleBrokerCheckSymbols,
    bestConsensusSymbol: best?.symbol ?? "NONE",
    bestConsensusMode: best?.unifiedDecisionMode ?? "CONSENSUS_BLOCKED",
    bestConsensusLevel: best?.consensusLevel ?? "NO_CONSENSUS",
    bestConsensusScore: best?.consensusScore ?? 0,
    bestConsensusGoCount: best?.goCount ?? 0,
    bestPortfolioRoute: best?.portfolioBrainRoute ?? "NO_TRADE_ROUTE",
    bestBrokerRoutingMode: best?.brokerRoutingMode ?? "NO_BROKER_ROUTE",
    bestExecutionPriority: best?.executionPriority ?? 0,
    bestFinalPositionSize: best?.finalPositionSize ?? 0,
    portfolioPriority: resolveConsensusPortfolioPriority(
      best?.unifiedDecisionMode ?? "CONSENSUS_BLOCKED"
    ),
    consensusRiskAdjustment: resolveConsensusRiskAdjustment(
      best?.unifiedDecisionMode ?? "CONSENSUS_BLOCKED"
    ),
    consensusAllocationBias: resolveConsensusAllocationBias(
      best?.unifiedDecisionMode ?? "CONSENSUS_BLOCKED"
    ),
    recommendation:
      best === null
        ? "No consensus-approved symbol available for Portfolio Brain allocation."
        : `${best.symbol} is the leading consensus Portfolio Brain candidate with ${best.unifiedDecisionMode}, priority ${best.executionPriority}, route ${best.portfolioBrainRoute}.`,
  };
}

function resolveRiskAdjustment(params: {
  reducedSpecies: number;
  archivedSpecies: number;
  protectedSpecies: number;
  autonomousEvolutionScore: number;
  cycleDecision: string;
  consensusRiskAdjustment: number;
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
    -40,
    Math.min(
      40,
      governanceAdjustment +
        autonomousAdjustment +
        scoreAdjustment +
        params.consensusRiskAdjustment
    )
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
  const consensusPortfolioSignal = buildConsensusPortfolioSignal();

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
    version: "V16.1.4",
    status: "READY",

    championSpecies: autonomousEvolutionSignal.championSpecies,

    protectedSpecies,
    activeSpecies,
    reducedSpecies,
    archivedSpecies,

    portfolioBias: `${resolvePortfolioBias(
      autonomousEvolutionSignal.championSpecies
    )} Consensus allocation bias: ${consensusPortfolioSignal.consensusAllocationBias}.`,

    portfolioRiskAdjustment: resolveRiskAdjustment({
      protectedSpecies,
      reducedSpecies,
      archivedSpecies,
      autonomousEvolutionScore:
        autonomousEvolutionSignal.autonomousEvolutionScore,
      cycleDecision: autonomousEvolutionSignal.cycleDecision,
      consensusRiskAdjustment: consensusPortfolioSignal.consensusRiskAdjustment,
    }),

    autonomousEvolutionSignal,
    consensusPortfolioSignal,

    decisions,

    summary:
      "Portfolio Brain Evolution Sync now combines Autonomous Trading Evolution with Multi-Style Consensus Unified Decision routing for portfolio allocation and risk bias.",

    createdAt: new Date().toISOString(),
  };
}
