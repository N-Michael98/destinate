import { generateStrategyEvolutionReport }
from "../strategy-evolution-intelligence";

import {
  MutationType,
  StrategyMutationEntry,
  StrategyMutationReport,
} from "./strategy-mutation-types";

function buildMutation(
  strategyId: string,
  strategyName: string,
  evolutionScore: number,
  type: MutationType,
  improvement: number,
  riskImpact: number
): StrategyMutationEntry {

  return {
    mutationId:
      `${strategyId}-${type}`,

    parentStrategyId:
      strategyId,

    parentStrategyName:
      strategyName,

    mutationType: type,

    originalEvolutionScore:
      evolutionScore,

    mutationScore:
      Math.min(
        100,
        evolutionScore + improvement
      ),

    projectedImprovement:
      improvement,

    riskImpact,

    mutationReason:
      `${type} mutation generated from ${strategyName}`,
  };
}

export function generateStrategyMutationReport():
  StrategyMutationReport {

  const evolution =
    generateStrategyEvolutionReport();

  const entries:
    StrategyMutationEntry[] = [];

  for (const strategy of evolution.entries) {

    entries.push(
      buildMutation(
        strategy.strategyId,
        strategy.strategyName,
        strategy.evolutionScore,
        "AGGRESSIVE",
        8,
        12
      )
    );

    entries.push(
      buildMutation(
        strategy.strategyId,
        strategy.strategyName,
        strategy.evolutionScore,
        "CONSERVATIVE",
        3,
        -8
      )
    );

    entries.push(
      buildMutation(
        strategy.strategyId,
        strategy.strategyName,
        strategy.evolutionScore,
        "NEWS_FILTERED",
        5,
        -3
      )
    );

    entries.push(
      buildMutation(
        strategy.strategyId,
        strategy.strategyName,
        strategy.evolutionScore,
        "SESSION_FILTERED",
        4,
        -2
      )
    );

    entries.push(
      buildMutation(
        strategy.strategyId,
        strategy.strategyName,
        strategy.evolutionScore,
        "RISK_REDUCED",
        2,
        -10
      )
    );
  }

  const best =
    [...entries].sort(
      (a, b) =>
        b.mutationScore -
        a.mutationScore
    )[0];

  return {
    version: "V13.4.0",
    status: "READY",

    totalParents:
      evolution.entries.length,

    totalMutations:
      entries.length,

    bestMutation:
      best
        ? `${best.parentStrategyName} (${best.mutationType})`
        : "NONE",

    entries,

    summary:
      "Strategy Mutation Engine creates evolutionary strategy variants for future testing and competition.",

    createdAt:
      new Date().toISOString(),
  };
}
