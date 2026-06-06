import {
  buildMarketRegimeSyncReport,
  MarketRegimeSyncItem,
} from "./market-regime-sync";

export type OpportunityDirection = "LONG" | "SHORT" | "WAIT";

export type MarketOpportunity = {
  rank: number;
  symbol: string;
  displayName: string;
  assetClass: string;
  tradingViewSymbol: string;
  regime: string;
  direction: OpportunityDirection;
  opportunityScore: number;
  trendScore: number;
  volatilityScore: number;
  strategyScore: number;
  riskScore: number;
  confidence: number;
  preferredStrategies: string[];
  reason: string;
};

export type OpportunityScannerReport = {
  version: string;
  status: "READY";
  totalMarketsScanned: number;
  tradableOpportunities: number;
  longOpportunities: number;
  shortOpportunities: number;
  waitOpportunities: number;
  bestOpportunity: MarketOpportunity | null;
  topOpportunities: MarketOpportunity[];
  opportunities: MarketOpportunity[];
  recommendation: string;
  updatedAt: string;
};

function calculateStrategyScore(market: MarketRegimeSyncItem): number {
  const fit = market.strategyFit;

  let score = 40;

  if (market.regime === "BULLISH" && fit.includes("TREND")) score += 25;
  if (market.regime === "BEARISH" && fit.includes("REVERSAL")) score += 25;
  if (market.regime === "RANGING" && fit.includes("MEAN_REVERSION")) score += 25;
  if (market.regime === "VOLATILE" && fit.includes("BREAKOUT")) score += 20;
  if (fit.includes("MACRO")) score += 8;
  if (fit.includes("NEWS")) score += 6;
  if (fit.includes("VOLATILITY")) score += 6;

  return Math.max(0, Math.min(100, score));
}

function calculateRiskScore(market: MarketRegimeSyncItem): number {
  const volatilityRisk =
    market.volatilityScore >= 90
      ? 35
      : market.volatilityScore >= 80
        ? 25
        : market.volatilityScore >= 65
          ? 15
          : 8;

  const regimeRisk =
    market.regime === "VOLATILE"
      ? 25
      : market.regime === "RANGING"
        ? 12
        : 8;

  return Math.max(0, Math.min(100, volatilityRisk + regimeRisk));
}

function calculateDirection(market: MarketRegimeSyncItem): OpportunityDirection {
  if (market.regime === "BULLISH") return "LONG";
  if (market.regime === "BEARISH") return "SHORT";
  if (market.regime === "VOLATILE") return "WAIT";
  return "WAIT";
}

function calculateConfidence(
  market: MarketRegimeSyncItem,
  strategyScore: number,
  riskScore: number
): number {
  const raw =
    market.opportunityScore * 0.45 +
    strategyScore * 0.35 +
    Math.abs(market.trendScore - 50) * 0.35 -
    riskScore * 0.25;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function preferredStrategies(market: MarketRegimeSyncItem): string[] {
  if (market.regime === "BULLISH") {
    return market.strategyFit.filter((strategy) =>
      ["TREND", "BREAKOUT", "RISK_ON", "MACRO"].includes(strategy)
    );
  }

  if (market.regime === "BEARISH") {
    return market.strategyFit.filter((strategy) =>
      ["REVERSAL", "TREND", "BREAKOUT", "SAFE_HAVEN"].includes(strategy)
    );
  }

  if (market.regime === "RANGING") {
    return market.strategyFit.filter((strategy) =>
      ["MEAN_REVERSION", "MACRO", "SAFE_HAVEN"].includes(strategy)
    );
  }

  return market.strategyFit.filter((strategy) =>
    ["BREAKOUT", "VOLATILITY", "NEWS"].includes(strategy)
  );
}

function buildReason(
  market: MarketRegimeSyncItem,
  direction: OpportunityDirection,
  confidence: number,
  riskScore: number,
  strategyScore: number
): string {
  return `${market.symbol} selected as ${direction} candidate from Market Regime Sync. Regime ${market.regime}, confidence ${confidence}, strategy score ${strategyScore}, risk score ${riskScore}.`;
}

export function buildOpportunityScannerReport(): OpportunityScannerReport {
  const regimeSync = buildMarketRegimeSyncReport();

  const opportunitiesUnranked = regimeSync.markets.map((market) => {
    const strategyScore = calculateStrategyScore(market);
    const riskScore = calculateRiskScore(market);
    const direction = calculateDirection(market);
    const confidence = calculateConfidence(market, strategyScore, riskScore);

    return {
      rank: 0,
      symbol: market.symbol,
      displayName: market.displayName,
      assetClass: market.assetClass,
      tradingViewSymbol: market.tradingViewSymbol,
      regime: market.regime,
      direction,
      opportunityScore: market.opportunityScore,
      trendScore: market.trendScore,
      volatilityScore: market.volatilityScore,
      strategyScore,
      riskScore,
      confidence,
      preferredStrategies: preferredStrategies(market),
      reason: buildReason(
        market,
        direction,
        confidence,
        riskScore,
        strategyScore
      ),
    };
  });

  const opportunities = opportunitiesUnranked
    .sort((a, b) => {
      const tradableA = a.direction === "WAIT" ? 0 : 1;
      const tradableB = b.direction === "WAIT" ? 0 : 1;

      if (tradableB !== tradableA) return tradableB - tradableA;
      return b.confidence - a.confidence;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const tradableOpportunities = opportunities.filter(
    (item) => item.direction !== "WAIT"
  ).length;

  const longOpportunities = opportunities.filter(
    (item) => item.direction === "LONG"
  ).length;

  const shortOpportunities = opportunities.filter(
    (item) => item.direction === "SHORT"
  ).length;

  const waitOpportunities = opportunities.filter(
    (item) => item.direction === "WAIT"
  ).length;

  const bestOpportunity =
    opportunities.find((item) => item.direction !== "WAIT") ?? null;

  const recommendation =
    bestOpportunity === null
      ? "No tradable opportunities detected. Keep scanning the market universe."
      : `${bestOpportunity.symbol} is currently the best opportunity with ${bestOpportunity.direction} bias, ${bestOpportunity.confidence}% confidence and ${bestOpportunity.riskScore} risk score.`;

  return {
    version: "V11.4.6",
    status: "READY",
    totalMarketsScanned: opportunities.length,
    tradableOpportunities,
    longOpportunities,
    shortOpportunities,
    waitOpportunities,
    bestOpportunity,
    topOpportunities: opportunities.slice(0, 5),
    opportunities,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}