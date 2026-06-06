import {
  buildOpportunityScannerReport,
  MarketOpportunity,
} from "./opportunity-scanner";

export type StrategyOpportunityMatch = {
  rank: number;
  symbol: string;
  displayName: string;
  direction: string;
  regime: string;
  confidence: number;
  riskScore: number;
  opportunityScore: number;
  strategyScore: number;
  selectedStrategy: string;
  strategyCategory: string;
  strategyConfidenceBoost: number;
  executionBias: "AGGRESSIVE" | "NORMAL" | "CAUTIOUS" | "WAIT";
  reason: string;
};

export type StrategyOpportunitySyncReport = {
  version: string;
  status: "READY";
  totalOpportunities: number;
  tradableOpportunities: number;
  bestMatch: StrategyOpportunityMatch | null;
  matches: StrategyOpportunityMatch[];
  recommendation: string;
  updatedAt: string;
};

function selectStrategy(opportunity: MarketOpportunity): {
  selectedStrategy: string;
  strategyCategory: string;
  strategyConfidenceBoost: number;
} {
  if (opportunity.direction === "WAIT") {
    return {
      selectedStrategy: "No Trade / Observation Mode",
      strategyCategory: "WAIT",
      strategyConfidenceBoost: 0,
    };
  }

  if (
    opportunity.regime === "BULLISH" &&
    opportunity.preferredStrategies.includes("TREND")
  ) {
    return {
      selectedStrategy: "Trend Continuation Strategy",
      strategyCategory: "TREND",
      strategyConfidenceBoost: 8,
    };
  }

  if (
    opportunity.regime === "BEARISH" &&
    opportunity.preferredStrategies.includes("REVERSAL")
  ) {
    return {
      selectedStrategy: "Bearish Reversal Strategy",
      strategyCategory: "REVERSAL",
      strategyConfidenceBoost: 7,
    };
  }

  if (
    opportunity.regime === "VOLATILE" &&
    opportunity.preferredStrategies.includes("BREAKOUT")
  ) {
    return {
      selectedStrategy: "Volatility Breakout Strategy",
      strategyCategory: "BREAKOUT",
      strategyConfidenceBoost: 5,
    };
  }

  if (opportunity.preferredStrategies.includes("MEAN_REVERSION")) {
    return {
      selectedStrategy: "Mean Reversion Strategy",
      strategyCategory: "MEAN_REVERSION",
      strategyConfidenceBoost: 4,
    };
  }

  return {
    selectedStrategy: "Default Risk-Managed Strategy",
    strategyCategory: "BALANCED",
    strategyConfidenceBoost: 2,
  };
}

function calculateExecutionBias(
  opportunity: MarketOpportunity,
  boostedConfidence: number
): "AGGRESSIVE" | "NORMAL" | "CAUTIOUS" | "WAIT" {
  if (opportunity.direction === "WAIT") return "WAIT";
  if (boostedConfidence >= 70 && opportunity.riskScore <= 25) return "AGGRESSIVE";
  if (boostedConfidence >= 55 && opportunity.riskScore <= 40) return "NORMAL";
  return "CAUTIOUS";
}

function buildReason(
  opportunity: MarketOpportunity,
  selectedStrategy: string,
  boostedConfidence: number,
  executionBias: string
): string {
  return `${opportunity.symbol} mapped to ${selectedStrategy}. Direction ${opportunity.direction}, regime ${opportunity.regime}, boosted confidence ${boostedConfidence}, execution bias ${executionBias}.`;
}

function buildMatch(opportunity: MarketOpportunity): StrategyOpportunityMatch {
  const strategy = selectStrategy(opportunity);
  const boostedConfidence = Math.min(
    100,
    opportunity.confidence + strategy.strategyConfidenceBoost
  );

  const executionBias = calculateExecutionBias(opportunity, boostedConfidence);

  return {
    rank: opportunity.rank,
    symbol: opportunity.symbol,
    displayName: opportunity.displayName,
    direction: opportunity.direction,
    regime: opportunity.regime,
    confidence: boostedConfidence,
    riskScore: opportunity.riskScore,
    opportunityScore: opportunity.opportunityScore,
    strategyScore: opportunity.strategyScore,
    selectedStrategy: strategy.selectedStrategy,
    strategyCategory: strategy.strategyCategory,
    strategyConfidenceBoost: strategy.strategyConfidenceBoost,
    executionBias,
    reason: buildReason(
      opportunity,
      strategy.selectedStrategy,
      boostedConfidence,
      executionBias
    ),
  };
}

export function buildStrategyOpportunitySyncReport(): StrategyOpportunitySyncReport {
  const scanner = buildOpportunityScannerReport();

  const matches = scanner.topOpportunities.map((opportunity) =>
    buildMatch(opportunity)
  );

  const tradableOpportunities = matches.filter(
    (match) => match.executionBias !== "WAIT"
  ).length;

  const bestMatch =
    matches.find((match) => match.executionBias !== "WAIT") ?? null;

  const recommendation =
    bestMatch === null
      ? "No strategy opportunity match is tradable. Keep scanning market universe."
      : `${bestMatch.symbol} is the best strategy match using ${bestMatch.selectedStrategy} with ${bestMatch.confidence}% boosted confidence and ${bestMatch.executionBias} execution bias.`;

  return {
    version: "V11.4.9",
    status: "READY",
    totalOpportunities: matches.length,
    tradableOpportunities,
    bestMatch,
    matches,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}