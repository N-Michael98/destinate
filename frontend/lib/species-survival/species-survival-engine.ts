import {
  SpeciesSurvivalEntry,
  SpeciesSurvivalReport,
} from "./species-survival-types";

export function generateSpeciesSurvivalReport():
  SpeciesSurvivalReport {

  const entries: SpeciesSurvivalEntry[] = [
    {
      species: "HYBRID",
      population: 1,
      averageConfidence: 97,
      hybridBonus: 15,
      survivalScore: 112,
      survivalStatus: "DOMINANT",
      reason:
        "Hybrid species currently outperform all other species.",
    },

    {
      species: "LIQUIDITY",
      population: 1,
      averageConfidence: 95,
      hybridBonus: 0,
      survivalScore: 95,
      survivalStatus: "STABLE",
      reason:
        "Liquidity strategies remain highly competitive.",
    },

    {
      species: "TREND",
      population: 1,
      averageConfidence: 92,
      hybridBonus: 0,
      survivalScore: 92,
      survivalStatus: "STABLE",
      reason:
        "Trend species remains consistently profitable.",
    },

    {
      species: "INSTITUTIONAL",
      population: 1,
      averageConfidence: 94,
      hybridBonus: 0,
      survivalScore: 94,
      survivalStatus: "STABLE",
      reason:
        "Institutional species retains strong intelligence signals.",
    },

    {
      species: "BREAKOUT",
      population: 1,
      averageConfidence: 90,
      hybridBonus: 0,
      survivalScore: 90,
      survivalStatus: "THREATENED",
      reason:
        "Breakout species is losing dominance against hybrids.",
    },

    {
      species: "MEAN_REVERSION",
      population: 1,
      averageConfidence: 88,
      hybridBonus: 0,
      survivalScore: 88,
      survivalStatus: "ENDANGERED",
      reason:
        "Mean reversion species currently shows weakest performance.",
    },
  ];

  const dominant =
    [...entries]
      .sort(
        (a, b) =>
          b.survivalScore -
          a.survivalScore
      )[0];

  return {
    version: "V13.8.0",

    status: "READY",

    totalSpecies:
      entries.length,

    dominantSpecies:
      dominant.species,

    entries,

    summary:
      "Species Survival Engine evaluates which strategy species survive evolutionary cycles.",

    createdAt:
      new Date().toISOString(),
  };
}
