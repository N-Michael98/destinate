import { generateEvolutionGovernanceReport } from "../evolution-governance";

import {
  EvolutionAllocationEntry,
  EvolutionAllocationReport,
} from "./evolution-allocation-types";

function resolveRawTargetAllocation(status: string): number {
  switch (status) {
    case "PROTECTED":
      return 40;

    case "ACTIVE":
      return 20;

    case "REDUCED":
      return 5;

    case "ARCHIVED":
      return 0;

    default:
      return 0;
  }
}

function normalizeAllocations(entries: EvolutionAllocationEntry[]) {
  const rawTotal = entries.reduce(
    (sum, entry) => sum + entry.targetAllocation,
    0
  );

  if (rawTotal <= 0) {
    return entries;
  }

  const normalized = entries.map((entry) => ({
    ...entry,
    targetAllocation: Math.floor(
      (entry.targetAllocation / rawTotal) * 100
    ),
  }));

  const normalizedTotal = normalized.reduce(
    (sum, entry) => sum + entry.targetAllocation,
    0
  );

  const difference = 100 - normalizedTotal;

  if (difference !== 0 && normalized.length > 0) {
    normalized[0].targetAllocation += difference;
  }

  return normalized.map((entry) => ({
    ...entry,
    allocationAdjustment:
      entry.targetAllocation - entry.currentAllocation,
  }));
}

export function getEvolutionAllocationReport(): EvolutionAllocationReport {
  const governance = generateEvolutionGovernanceReport();

  const currentAllocation = Math.round(
    100 / governance.decisions.length
  );

  const rawEntries: EvolutionAllocationEntry[] =
    governance.decisions.map((decision) => {
      const targetAllocation =
        resolveRawTargetAllocation(decision.status);

      return {
        species: decision.species,
        governanceStatus: decision.status,
        governanceScore: decision.governanceScore,

        currentAllocation,
        targetAllocation,

        allocationAdjustment:
          targetAllocation - currentAllocation,

        reason: decision.reason,
      };
    });

  const entries = normalizeAllocations(rawEntries);

  const champion =
    governance.decisions.find(
      (decision) => decision.status === "PROTECTED"
    )?.species ?? "NONE";

  return {
    version: "V14.2.0",
    status: "READY",

    championSpecies: champion,

    totalAllocation: entries.reduce(
      (sum, entry) => sum + entry.targetAllocation,
      0
    ),

    entries,

    summary:
      "Evolution Allocation Engine converts governance decisions into normalized portfolio allocation targets.",

    createdAt: new Date().toISOString(),
  };
}
