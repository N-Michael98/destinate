import { generateEvolutionGovernanceReport } from "../evolution-governance";
import {
  EvolutionAllocationEntry,
  EvolutionAllocationReport,
} from "./evolution-allocation-types";

export function getEvolutionAllocationReport(): EvolutionAllocationReport {
  const governance = generateEvolutionGovernanceReport();

  const entries: EvolutionAllocationEntry[] =
    governance.decisions.map((decision) => {
      let targetAllocation = 0;

      switch (decision.status) {
        case "PROTECTED":
          targetAllocation = 40;
          break;

        case "ACTIVE":
          targetAllocation = 20;
          break;

        case "REDUCED":
          targetAllocation = 5;
          break;

        case "ARCHIVED":
          targetAllocation = 0;
          break;

        default:
          targetAllocation = 0;
      }

      const currentAllocation = Math.round(
        100 / governance.decisions.length
      );

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

  const champion =
    governance.decisions.find(
      (d) => d.status === "PROTECTED"
    )?.species ?? "NONE";

  return {
    version: "V14.2.0",

    status: "READY",

    championSpecies: champion,

    totalAllocation: entries.reduce(
      (sum, e) => sum + e.targetAllocation,
      0
    ),

    entries,

    summary:
      "Evolution Allocation Engine converts governance decisions into portfolio allocation targets.",

    createdAt: new Date().toISOString(),
  };
}
