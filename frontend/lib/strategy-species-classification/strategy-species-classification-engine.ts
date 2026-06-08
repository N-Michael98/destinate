import {
  StrategySpecies,
  StrategySpeciesEntry,
  StrategySpeciesClassificationReport,
} from "./strategy-species-classification-types";

function classifyStrategy(
  strategyName: string
): StrategySpeciesEntry {

  const name =
    strategyName.toLowerCase();

  if (
    name.includes(" x ")
  ) {
    return {
      strategyName,
      species: "HYBRID",
      confidence: 97,
      reason:
        "Breeding hybrid detected",
    };
  }

  if (
    name.includes("liquidity")
  ) {
    return {
      strategyName,
      species: "LIQUIDITY",
      confidence: 95,
      reason:
        "Liquidity keyword detected",
    };
  }

  if (
    name.includes("trend")
  ) {
    return {
      strategyName,
      species: "TREND",
      confidence: 92,
      reason:
        "Trend keyword detected",
    };
  }

  if (
    name.includes("swing")
  ) {
    return {
      strategyName,
      species: "SWING",
      confidence: 90,
      reason:
        "Swing keyword detected",
    };
  }

  if (
    name.includes("breakout")
  ) {
    return {
      strategyName,
      species: "BREAKOUT",
      confidence: 90,
      reason:
        "Breakout keyword detected",
    };
  }

  if (
    name.includes("institutional")
  ) {
    return {
      strategyName,
      species: "INSTITUTIONAL",
      confidence: 94,
      reason:
        "Institutional keyword detected",
    };
  }

  if (
    name.includes("mean")
  ) {
    return {
      strategyName,
      species: "MEAN_REVERSION",
      confidence: 88,
      reason:
        "Mean reversion keyword detected",
    };
  }

  if (
    name.includes("scalp")
  ) {
    return {
      strategyName,
      species: "SCALPING",
      confidence: 93,
      reason:
        "Scalping keyword detected",
    };
  }

  if (
    name.includes(" x ")
  ) {
    return {
      strategyName,
      species: "HYBRID",
      confidence: 97,
      reason:
        "Breeding hybrid detected",
    };
  }

  return {
    strategyName,
    species: "TREND",
    confidence: 60,
    reason:
      "Fallback classification",
  };
}

export function generateStrategySpeciesClassificationReport():
  StrategySpeciesClassificationReport {

  const strategies = [
    "Trend Pullback Swing",
    "Liquidity Sweep Scalping",
    "Institutional Momentum",
    "Breakout Expansion",
    "Mean Reversion EURUSD",
    "Trend Pullback Swing x Liquidity Sweep Scalping",
  ];

  const entries =
    strategies.map(
      classifyStrategy
    );

  const speciesCounts:
    Record<string, number> = {};

  entries.forEach(entry => {

    speciesCounts[
      entry.species
    ] =
      (
        speciesCounts[
          entry.species
        ] ?? 0
      ) + 1;

  });

  return {
    version: "V13.7.0",
    status: "READY",

    totalStrategies:
      entries.length,

    speciesCounts,

    entries,

    summary:
      "Strategy Species Classification Engine groups strategies into evolutionary families.",

    createdAt:
      new Date().toISOString(),
  };
}

