import { generateStrategyMutationReport }
from "../strategy-mutation";

import {
  MutationCompetitionEntry,
  MutationCompetitionReport,
  MutationCompetitionStatus,
} from "./mutation-competition-types";

function resolveStatus(
  rank: number
): MutationCompetitionStatus {

  if (rank <= 3) {
    return "CHAMPION";
  }

  if (rank <= 10) {
    return "CONTENDER";
  }

  if (rank <= 25) {
    return "AVERAGE";
  }

  return "ELIMINATED";
}

export function generateMutationCompetitionReport():
  MutationCompetitionReport {

  const mutations =
    generateStrategyMutationReport();

  const deduped =
    new Map<string, MutationCompetitionEntry>();

  for (const mutation of mutations.entries) {

    const competitionScore =
      Math.round(
        mutation.mutationScore +
        mutation.projectedImprovement -
        Math.max(0, mutation.riskImpact * 0.25)
      );

    const entry: MutationCompetitionEntry = {
      mutationId:
        mutation.mutationId,

      strategyName:
        mutation.parentStrategyName,

      mutationType:
        mutation.mutationType,

      mutationScore:
        mutation.mutationScore,

      projectedImprovement:
        mutation.projectedImprovement,

      riskImpact:
        mutation.riskImpact,

      competitionScore,

      rank: 0,

      status: "AVERAGE",
    };

    const existing =
      deduped.get(
        mutation.mutationId
      );

    if (
      !existing ||
      competitionScore >
      existing.competitionScore
    ) {
      deduped.set(
        mutation.mutationId,
        entry
      );
    }
  }

  const ranked =
    Array.from(
      deduped.values()
    ).sort(
      (a, b) =>
        b.competitionScore -
        a.competitionScore
    );

  ranked.forEach(
    (entry, index) => {

      entry.rank =
        index + 1;

      entry.status =
        resolveStatus(
          entry.rank
        );
    }
  );

  return {
    version: "V13.5.0",
    status: "READY",

    totalCompetitors:
      ranked.length,

    championCount:
      ranked.filter(
        x => x.status === "CHAMPION"
      ).length,

    contenderCount:
      ranked.filter(
        x => x.status === "CONTENDER"
      ).length,

    averageCount:
      ranked.filter(
        x => x.status === "AVERAGE"
      ).length,

    eliminatedCount:
      ranked.filter(
        x => x.status === "ELIMINATED"
      ).length,

    championMutation:
      ranked[0]
        ? `${ranked[0].strategyName} (${ranked[0].mutationType})`
        : "NONE",

    entries: ranked,

    summary:
      "Mutation Competition Engine ranks all strategy mutations and identifies the strongest evolutionary candidates.",

    createdAt:
      new Date().toISOString(),
  };
}
