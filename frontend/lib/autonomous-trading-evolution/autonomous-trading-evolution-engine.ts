import { generateStrategyRankingReport } from "@/lib/strategy-ranking";
import { generateStrategyMutationReport } from "@/lib/strategy-mutation";
import { generateStrategyBreedingReport } from "@/lib/strategy-breeding";
import { generateSpeciesSurvivalReport } from "@/lib/species-survival";
import { generateEvolutionGovernanceReport } from "@/lib/evolution-governance";

import {
  AutonomousTradingEvolutionDecision,
  AutonomousTradingEvolutionReport,
  AutonomousTradingEvolutionCycleStatus,
} from "./autonomous-trading-evolution-types";

const VERSION = "V16.0.0" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildCycleId() {
  return `autonomous-evolution-${Date.now()}`;
}

function getTopStrategyName(ranking: ReturnType<typeof generateStrategyRankingReport>) {
  const top =
    [...ranking.profiles].sort(
      (a, b) => b.finalStrategyScore - a.finalStrategyScore
    )[0];

  return top ? top.strategyName : "NONE";
}

function getTopStrategyScore(ranking: ReturnType<typeof generateStrategyRankingReport>) {
  const top =
    [...ranking.profiles].sort(
      (a, b) => b.finalStrategyScore - a.finalStrategyScore
    )[0];

  return top ? top.finalStrategyScore : 0;
}

function calculateAutonomousEvolutionScore(params: {
  topStrategyScore: number;
  totalMutations: number;
  totalHybrids: number;
  protectedSpecies: number;
  activeSpecies: number;
  archivedSpecies: number;
}) {
  return clamp(
    Math.round(
      params.topStrategyScore * 0.45 +
        Math.min(params.totalMutations, 50) * 0.3 +
        Math.min(params.totalHybrids, 20) * 0.6 +
        params.protectedSpecies * 8 +
        params.activeSpecies * 5 -
        params.archivedSpecies * 4
    ),
    0,
    100
  );
}

function resolveStatus(score: number): AutonomousTradingEvolutionCycleStatus {
  if (score >= 70) return "READY";
  if (score >= 50) return "NEEDS_REVIEW";
  return "BLOCKED";
}

function resolveCycleDecision(
  score: number
): AutonomousTradingEvolutionReport["cycleDecision"] {
  if (score >= 70) return "CONTINUE_EVOLUTION";
  if (score >= 50) return "REDUCE_RISK";
  return "PAUSE_EVOLUTION";
}

function buildDecisions(params: {
  topStrategy: string;
  topStrategyScore: number;
  bestMutation: string;
  bestHybrid: string;
  championSpecies: string;
  autonomousEvolutionScore: number;
}): AutonomousTradingEvolutionDecision[] {
  return [
    {
      key: "top-strategy",
      title: "Top Strategy Selection",
      status: params.topStrategyScore >= 70 ? "APPROVED" : "WATCHLIST",
      score: params.topStrategyScore,
      reason: `${params.topStrategy} is currently the highest ranked strategy candidate.`,
    },
    {
      key: "mutation-cycle",
      title: "Mutation Cycle",
      status: params.bestMutation === "NONE" ? "REVIEW" : "APPROVED",
      score: params.bestMutation === "NONE" ? 0 : 80,
      reason: `Best mutation candidate resolved as ${params.bestMutation}.`,
    },
    {
      key: "breeding-cycle",
      title: "Breeding Cycle",
      status: params.bestHybrid === "NONE" ? "REVIEW" : "APPROVED",
      score: params.bestHybrid === "NONE" ? 0 : 82,
      reason: `Best hybrid candidate resolved as ${params.bestHybrid}.`,
    },
    {
      key: "species-governance",
      title: "Species Governance",
      status: params.championSpecies === "HYBRID" ? "APPROVED" : "WATCHLIST",
      score: params.championSpecies === "HYBRID" ? 90 : 70,
      reason: `${params.championSpecies} is currently the champion species.`,
    },
    {
      key: "autonomous-evolution-score",
      title: "Autonomous Evolution Score",
      status:
        params.autonomousEvolutionScore >= 70
          ? "APPROVED"
          : params.autonomousEvolutionScore >= 50
            ? "WATCHLIST"
            : "BLOCKED",
      score: params.autonomousEvolutionScore,
      reason: `Overall autonomous evolution score is ${params.autonomousEvolutionScore}.`,
    },
  ];
}

export function generateAutonomousTradingEvolutionReport(): AutonomousTradingEvolutionReport {
  const ranking = generateStrategyRankingReport();
  const mutation = generateStrategyMutationReport();
  const breeding = generateStrategyBreedingReport();
  const survival = generateSpeciesSurvivalReport();
  const governance = generateEvolutionGovernanceReport();

  const topStrategy = getTopStrategyName(ranking);
  const topStrategyScore = getTopStrategyScore(ranking);

  const autonomousEvolutionScore = calculateAutonomousEvolutionScore({
    topStrategyScore,
    totalMutations: mutation.totalMutations,
    totalHybrids: breeding.totalHybrids,
    protectedSpecies: governance.protectedSpecies,
    activeSpecies: governance.activeSpecies,
    archivedSpecies: governance.archivedSpecies,
  });

  const status = resolveStatus(autonomousEvolutionScore);
  const cycleDecision = resolveCycleDecision(autonomousEvolutionScore);

  const decisions = buildDecisions({
    topStrategy,
    topStrategyScore,
    bestMutation: mutation.bestMutation,
    bestHybrid: breeding.bestHybrid,
    championSpecies: governance.championSpecies,
    autonomousEvolutionScore,
  });

  return {
    version: VERSION,
    status,
    cycleId: buildCycleId(),
    rankingVersion: ranking.version,
    mutationVersion: mutation.version,
    breedingVersion: breeding.version,
    survivalVersion: survival.version,
    governanceVersion: governance.version,
    totalRankedStrategies: ranking.profiles.length,
    totalMutations: mutation.totalMutations,
    totalHybrids: breeding.totalHybrids,
    totalSpecies: survival.totalSpecies,
    championSpecies: governance.championSpecies,
    topStrategy,
    bestMutation: mutation.bestMutation,
    bestHybrid: breeding.bestHybrid,
    autonomousEvolutionScore,
    cycleDecision,
    decisions,
    summary:
      "Autonomous Trading Evolution Engine orchestrates ranking, mutation, breeding, survival and governance into one trading-bot evolution cycle.",
    createdAt: new Date().toISOString(),
  };
}
