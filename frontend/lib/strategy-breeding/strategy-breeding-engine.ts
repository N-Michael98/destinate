import { generateMutationCompetitionReport }
from "../mutation-competition";

import {
  StrategyBreedingEntry,
  StrategyBreedingReport,
} from "./strategy-breeding-types";

export function generateStrategyBreedingReport():
  StrategyBreedingReport {

  const competition =
    generateMutationCompetitionReport();

  const champions =
    competition.entries
      .filter(
        x =>
          x.status === "CHAMPION"
      )
      .slice(0, 5);

  const entries:
    StrategyBreedingEntry[] = [];

  for (
    let i = 0;
    i < champions.length;
    i++
  ) {

    for (
      let j = i + 1;
      j < champions.length;
      j++
    ) {

      const a =
        champions[i];

      const b =
        champions[j];

      const hybridScore =
        Math.round(
          (
            a.competitionScore +
            b.competitionScore
          ) / 2
          + 3
        );

      entries.push({
        hybridId:
          `hybrid-${i}-${j}`,

        parentA:
          a.strategyName,

        parentB:
          b.strategyName,

        hybridName:
          `${a.strategyName} × ${b.strategyName}`,

        parentAScore:
          a.competitionScore,

        parentBScore:
          b.competitionScore,

        hybridScore,

        expectedImprovement:
          Math.round(
            hybridScore -
            (
              (
                a.competitionScore +
                b.competitionScore
              ) / 2
            )
          ),

        breedingConfidence:
          Math.min(
            100,
            Math.round(
              hybridScore
            )
          ),

        breedingReason:
          `Hybrid generated from champion mutations of ${a.strategyName} and ${b.strategyName}`,
      });
    }
  }

  const best =
    [...entries]
      .sort(
        (a, b) =>
          b.hybridScore -
          a.hybridScore
      )[0];

  return {
    version: "V13.6.0",
    status: "READY",

    totalHybrids:
      entries.length,

    bestHybrid:
      best
        ? best.hybridName
        : "NONE",

    entries,

    summary:
      "Strategy Breeding Engine creates hybrid strategies from champion mutation candidates.",

    createdAt:
      new Date().toISOString(),
  };
}
