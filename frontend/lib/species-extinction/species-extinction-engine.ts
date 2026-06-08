import {
  SpeciesExtinctionEntry,
  SpeciesExtinctionReport,
} from "./species-extinction-types";

export function generateSpeciesExtinctionReport():
  SpeciesExtinctionReport {

  const entries: SpeciesExtinctionEntry[] = [
    {
      species: "HYBRID",
      survivalStatus: "DOMINANT",
      survivalScore: 112,
      extinctionRisk: 0,
      action: "PROTECTED",
      reason:
        "Dominant species protected from extinction.",
    },

    {
      species: "LIQUIDITY",
      survivalStatus: "STABLE",
      survivalScore: 95,
      extinctionRisk: 10,
      action: "MONITOR",
      reason:
        "Healthy species monitored for future changes.",
    },

    {
      species: "TREND",
      survivalStatus: "STABLE",
      survivalScore: 92,
      extinctionRisk: 12,
      action: "MONITOR",
      reason:
        "Trend species remains active.",
    },

    {
      species: "INSTITUTIONAL",
      survivalStatus: "STABLE",
      survivalScore: 94,
      extinctionRisk: 9,
      action: "MONITOR",
      reason:
        "Institutional species remains healthy.",
    },

    {
      species: "BREAKOUT",
      survivalStatus: "THREATENED",
      survivalScore: 90,
      extinctionRisk: 45,
      action: "REDUCE",
      reason:
        "Threatened species losing competitiveness.",
    },

    {
      species: "MEAN_REVERSION",
      survivalStatus: "ENDANGERED",
      survivalScore: 88,
      extinctionRisk: 80,
      action: "ARCHIVE",
      reason:
        "Endangered species selected as extinction candidate.",
    },
  ];

  return {
    version: "V13.9.0",

    status: "READY",

    totalSpecies:
      entries.length,

    archivedCandidates:
      entries.filter(
        x => x.action === "ARCHIVE"
      ).length,

    extinctionThreats:
      entries.filter(
        x =>
          x.action === "REDUCE" ||
          x.action === "ARCHIVE"
      ).length,

    entries,

    summary:
      "Species Extinction Engine identifies species at risk and prepares archival decisions.",

    createdAt:
      new Date().toISOString(),
  };
}
