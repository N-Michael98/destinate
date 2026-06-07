import { generateBrokerPerformanceMemoryReport } from "../broker-performance-memory";
import { BrokerId, TradingStyle } from "../smart-broker-selection";
import { MarketCategory } from "../broker-performance-memory";

import {
  StrategyBrokerIntelligenceReport,
  StrategyBrokerIntelligenceStatus,
  StrategyBrokerMatchProfile,
  StrategyBrokerRecommendation,
  StrategyType,
} from "./strategy-broker-intelligence-types";

const VERSION = "V12.9.0" as const;

function round0(value: number): number {
  return Math.round(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBrokerName(brokerId: BrokerId): string {
  return brokerId === "IC_MARKETS" ? "IC Markets" : "Capital.com";
}

function getStrategyName(strategyType: StrategyType): string {
  const names: Record<StrategyType, string> = {
    LIQUIDITY_SWEEP_SCALPING: "Liquidity Sweep Scalping",
    BREAKOUT_DAYTRADING: "Breakout Daytrading",
    TREND_PULLBACK_SWING: "Trend Pullback Swing",
    MEAN_REVERSION_DAYTRADING: "Mean Reversion Daytrading",
    NEWS_VOLATILITY_SCALPING: "News Volatility Scalping",
  };

  return names[strategyType];
}

function getStrategyMemory(input: {
  strategyType: StrategyType;
  brokerId: BrokerId;
  market: MarketCategory;
  tradingStyle: TradingStyle;
}): {
  strategySuccessRate: number;
  strategyProfitFactor: number;
  strategyDrawdownPercent: number;
} {
  const key = `${input.strategyType}-${input.brokerId}-${input.market}-${input.tradingStyle}`;

  const memories: Record<
    string,
    {
      strategySuccessRate: number;
      strategyProfitFactor: number;
      strategyDrawdownPercent: number;
    }
  > = {
    "LIQUIDITY_SWEEP_SCALPING-IC_MARKETS-GOLD-SCALPING": {
      strategySuccessRate: 66,
      strategyProfitFactor: 1.94,
      strategyDrawdownPercent: 5.8,
    },
    "LIQUIDITY_SWEEP_SCALPING-CAPITAL_COM-GOLD-SCALPING": {
      strategySuccessRate: 53,
      strategyProfitFactor: 1.24,
      strategyDrawdownPercent: 10.2,
    },
    "BREAKOUT_DAYTRADING-IC_MARKETS-INDICES-DAYTRADING": {
      strategySuccessRate: 61,
      strategyProfitFactor: 1.56,
      strategyDrawdownPercent: 7.2,
    },
    "BREAKOUT_DAYTRADING-CAPITAL_COM-INDICES-DAYTRADING": {
      strategySuccessRate: 64,
      strategyProfitFactor: 1.68,
      strategyDrawdownPercent: 6.7,
    },
    "TREND_PULLBACK_SWING-IC_MARKETS-FOREX-SWING": {
      strategySuccessRate: 59,
      strategyProfitFactor: 1.45,
      strategyDrawdownPercent: 7.9,
    },
    "TREND_PULLBACK_SWING-CAPITAL_COM-FOREX-SWING": {
      strategySuccessRate: 68,
      strategyProfitFactor: 1.83,
      strategyDrawdownPercent: 5.6,
    },
    "MEAN_REVERSION_DAYTRADING-IC_MARKETS-FOREX-DAYTRADING": {
      strategySuccessRate: 58,
      strategyProfitFactor: 1.38,
      strategyDrawdownPercent: 8.4,
    },
    "MEAN_REVERSION_DAYTRADING-CAPITAL_COM-FOREX-DAYTRADING": {
      strategySuccessRate: 62,
      strategyProfitFactor: 1.52,
      strategyDrawdownPercent: 7.1,
    },
    "NEWS_VOLATILITY_SCALPING-IC_MARKETS-GOLD-SCALPING": {
      strategySuccessRate: 64,
      strategyProfitFactor: 1.72,
      strategyDrawdownPercent: 8.5,
    },
    "NEWS_VOLATILITY_SCALPING-CAPITAL_COM-GOLD-SCALPING": {
      strategySuccessRate: 49,
      strategyProfitFactor: 1.12,
      strategyDrawdownPercent: 12.8,
    },
  };

  return (
    memories[key] ?? {
      strategySuccessRate: 55,
      strategyProfitFactor: 1.25,
      strategyDrawdownPercent: 9,
    }
  );
}

function getBrokerPerformance(input: {
  brokerId: BrokerId;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
}): {
  brokerPerformanceScore: number;
  brokerConfidenceScore: number;
} {
  const report = generateBrokerPerformanceMemoryReport();

  const profile = report.performanceProfiles.find(
    (item) =>
      item.brokerId === input.brokerId &&
      item.market === input.market &&
      item.symbol === input.symbol &&
      item.tradingStyle === input.tradingStyle
  );

  return {
    brokerPerformanceScore: profile?.performanceScore ?? 55,
    brokerConfidenceScore: profile?.confidenceScore ?? 55,
  };
}

function calculateBrokerSuitabilityScore(params: {
  brokerPerformanceScore: number;
  brokerConfidenceScore: number;
  strategySuccessRate: number;
  strategyProfitFactor: number;
  strategyDrawdownPercent: number;
}): number {
  const profitFactorScore = clamp(params.strategyProfitFactor * 35, 0, 100);
  const drawdownScore = clamp(100 - params.strategyDrawdownPercent * 6, 0, 100);

  return clamp(
    round0(
      params.brokerPerformanceScore * 0.3 +
        params.brokerConfidenceScore * 0.15 +
        params.strategySuccessRate * 0.25 +
        profitFactorScore * 0.18 +
        drawdownScore * 0.12
    ),
    0,
    100
  );
}

function calculateFinalMatchScore(params: {
  brokerSuitabilityScore: number;
  brokerPerformanceScore: number;
  strategySuccessRate: number;
  strategyProfitFactor: number;
  strategyDrawdownPercent: number;
}): number {
  const profitFactorScore = clamp(params.strategyProfitFactor * 35, 0, 100);
  const drawdownScore = clamp(100 - params.strategyDrawdownPercent * 6, 0, 100);

  return clamp(
    round0(
      params.brokerSuitabilityScore * 0.38 +
        params.brokerPerformanceScore * 0.22 +
        params.strategySuccessRate * 0.18 +
        profitFactorScore * 0.14 +
        drawdownScore * 0.08
    ),
    0,
    100
  );
}

function resolveStatus(score: number): StrategyBrokerIntelligenceStatus {
  if (score >= 75) return "MATCHED";
  if (score >= 65) return "READY";
  if (score >= 55) return "WATCHLIST";
  return "BLOCKED";
}

function resolveRecommendation(
  score: number
): "BEST_MATCH" | "GOOD_MATCH" | "WATCHLIST" | "AVOID" {
  if (score >= 78) return "BEST_MATCH";
  if (score >= 68) return "GOOD_MATCH";
  if (score >= 55) return "WATCHLIST";
  return "AVOID";
}

function buildReasons(params: {
  brokerName: string;
  strategyName: string;
  market: MarketCategory;
  tradingStyle: TradingStyle;
  brokerPerformanceScore: number;
  strategySuccessRate: number;
  strategyProfitFactor: number;
  finalMatchScore: number;
  recommendation: string;
}): string[] {
  return [
    `${params.brokerName} match score for ${params.strategyName} is ${params.finalMatchScore}.`,
    `Market/style context: ${params.market} ${params.tradingStyle}.`,
    `Broker performance score ${params.brokerPerformanceScore}, strategy success rate ${params.strategySuccessRate}%, profit factor ${params.strategyProfitFactor}.`,
    `Recommendation resolved as ${params.recommendation}.`,
  ];
}

function createMatchProfile(input: {
  strategyType: StrategyType;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  brokerId: BrokerId;
}): StrategyBrokerMatchProfile {
  const strategyName = getStrategyName(input.strategyType);
  const brokerName = getBrokerName(input.brokerId);

  const brokerPerformance = getBrokerPerformance({
    brokerId: input.brokerId,
    market: input.market,
    symbol: input.symbol,
    tradingStyle: input.tradingStyle,
  });

  const strategyMemory = getStrategyMemory({
    strategyType: input.strategyType,
    brokerId: input.brokerId,
    market: input.market,
    tradingStyle: input.tradingStyle,
  });

  const brokerSuitabilityScore = calculateBrokerSuitabilityScore({
    ...brokerPerformance,
    ...strategyMemory,
  });

  const finalMatchScore = calculateFinalMatchScore({
    brokerSuitabilityScore,
    brokerPerformanceScore: brokerPerformance.brokerPerformanceScore,
    strategySuccessRate: strategyMemory.strategySuccessRate,
    strategyProfitFactor: strategyMemory.strategyProfitFactor,
    strategyDrawdownPercent: strategyMemory.strategyDrawdownPercent,
  });

  const status = resolveStatus(finalMatchScore);
  const recommendation = resolveRecommendation(finalMatchScore);

  return {
    id: `${input.strategyType}-${input.symbol}-${input.tradingStyle}-${input.brokerId}`,
    strategyType: input.strategyType,
    strategyName,
    market: input.market,
    symbol: input.symbol,
    tradingStyle: input.tradingStyle,
    brokerId: input.brokerId,
    brokerName,
    brokerPerformanceScore: brokerPerformance.brokerPerformanceScore,
    brokerConfidenceScore: brokerPerformance.brokerConfidenceScore,
    strategySuccessRate: strategyMemory.strategySuccessRate,
    strategyProfitFactor: strategyMemory.strategyProfitFactor,
    strategyDrawdownPercent: strategyMemory.strategyDrawdownPercent,
    brokerSuitabilityScore,
    finalMatchScore,
    status,
    recommendation,
    reasons: buildReasons({
      brokerName,
      strategyName,
      market: input.market,
      tradingStyle: input.tradingStyle,
      brokerPerformanceScore: brokerPerformance.brokerPerformanceScore,
      strategySuccessRate: strategyMemory.strategySuccessRate,
      strategyProfitFactor: strategyMemory.strategyProfitFactor,
      finalMatchScore,
      recommendation,
    }),
  };
}

function buildMatchProfiles(): StrategyBrokerMatchProfile[] {
  const strategies: {
    strategyType: StrategyType;
    market: MarketCategory;
    symbol: string;
    tradingStyle: TradingStyle;
  }[] = [
    {
      strategyType: "LIQUIDITY_SWEEP_SCALPING",
      market: "GOLD",
      symbol: "XAUUSD",
      tradingStyle: "SCALPING",
    },
    {
      strategyType: "BREAKOUT_DAYTRADING",
      market: "INDICES",
      symbol: "NAS100",
      tradingStyle: "DAYTRADING",
    },
    {
      strategyType: "TREND_PULLBACK_SWING",
      market: "FOREX",
      symbol: "EURUSD",
      tradingStyle: "SWING",
    },
    {
      strategyType: "MEAN_REVERSION_DAYTRADING",
      market: "FOREX",
      symbol: "EURUSD",
      tradingStyle: "DAYTRADING",
    },
    {
      strategyType: "NEWS_VOLATILITY_SCALPING",
      market: "GOLD",
      symbol: "XAUUSD",
      tradingStyle: "SCALPING",
    },
  ];

  const brokerIds: BrokerId[] = ["IC_MARKETS", "CAPITAL_COM"];

  return strategies
    .flatMap((strategy) =>
      brokerIds.map((brokerId) =>
        createMatchProfile({
          ...strategy,
          brokerId,
        })
      )
    )
    .sort((a, b) => b.finalMatchScore - a.finalMatchScore);
}

function buildRecommendations(
  profiles: StrategyBrokerMatchProfile[]
): StrategyBrokerRecommendation[] {
  const strategyKeys = Array.from(
    new Set(
      profiles.map(
        (profile) =>
          `${profile.strategyType}|${profile.market}|${profile.symbol}|${profile.tradingStyle}`
      )
    )
  );

  return strategyKeys.map((key) => {
    const [strategyType, market, symbol, tradingStyle] = key.split("|") as [
      StrategyType,
      MarketCategory,
      string,
      TradingStyle,
    ];

    const matches = profiles
      .filter(
        (profile) =>
          profile.strategyType === strategyType &&
          profile.market === market &&
          profile.symbol === symbol &&
          profile.tradingStyle === tradingStyle
      )
      .sort((a, b) => b.finalMatchScore - a.finalMatchScore);

    const best = matches[0];
    const alternative = matches[1];

    return {
      strategyType,
      strategyName: getStrategyName(strategyType),
      market,
      symbol,
      tradingStyle,
      preferredBroker: best?.brokerId ?? "NONE",
      preferredBrokerName: best?.brokerName ?? "None",
      bestMatchScore: best?.finalMatchScore ?? 0,
      alternativeBroker: alternative?.brokerId ?? "NONE",
      alternativeBrokerName: alternative?.brokerName ?? "None",
      alternativeMatchScore: alternative?.finalMatchScore ?? 0,
      recommendationReason: best
        ? `${best.brokerName} is preferred for ${best.strategyName} on ${symbol} because it has the strongest strategy-broker match score.`
        : "No broker recommendation available.",
    };
  });
}

function resolveReportStatus(
  profiles: StrategyBrokerMatchProfile[]
): StrategyBrokerIntelligenceStatus {
  if (profiles.every((profile) => profile.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (profiles.some((profile) => profile.status === "MATCHED")) {
    return "MATCHED";
  }

  if (profiles.some((profile) => profile.status === "READY")) {
    return "READY";
  }

  return "WATCHLIST";
}

function buildIntelligenceNotes(
  recommendations: StrategyBrokerRecommendation[]
): string[] {
  return recommendations.map((item) => {
    return `${item.strategyName} ${item.symbol}: preferred broker ${item.preferredBrokerName} with match score ${item.bestMatchScore}.`;
  });
}

export function generateStrategyBrokerIntelligenceReport(): StrategyBrokerIntelligenceReport {
  const matchProfiles = buildMatchProfiles();
  const recommendations = buildRecommendations(matchProfiles);

  const strongest = matchProfiles[0];
  const weakest = matchProfiles[matchProfiles.length - 1];

  return {
    version: VERSION,
    status: resolveReportStatus(matchProfiles),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalMatches: matchProfiles.length,
    totalRecommendations: recommendations.length,
    strongestMatch: strongest
      ? `${strongest.strategyName} → ${strongest.brokerName}`
      : "NONE",
    weakestMatch: weakest
      ? `${weakest.strategyName} → ${weakest.brokerName}`
      : "NONE",
    matchProfiles,
    recommendations,
    summary:
      "Strategy Broker Intelligence matched trading strategies with broker performance memory to create simulated broker suitability recommendations.",
    intelligenceNotes: buildIntelligenceNotes(recommendations),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      intelligenceMode: "SIMULATED_STRATEGY_BROKER_MATCHING",
    },
    createdAt: new Date().toISOString(),
  };
}
