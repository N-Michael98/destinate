import { generateStrategyBrokerIntelligenceReport } from "../strategy-broker-intelligence";
import { generateStrategyUniverseRegistryReport } from "../strategy-universe-registry";

import {
  MarketStrategyRanking,
  StrategyRankingProfile,
  StrategyRankingReport,
  StrategyRankingStatus,
} from "./strategy-ranking-types";

const VERSION = "V13.0.0" as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function calculateWinRateScore(strategyName: string): number {
  if (strategyName.includes("Liquidity Sweep")) return 72;
  if (strategyName.includes("News Volatility")) return 68;
  if (strategyName.includes("Trend Pullback")) return 74;
  if (strategyName.includes("Breakout")) return 66;
  if (strategyName.includes("Mean Reversion")) return 62;
  if (strategyName.includes("Orderblock")) return 70;
  if (strategyName.includes("Fair Value Gap")) return 67;
  if (strategyName.includes("Opening Range")) return 65;
  if (strategyName.includes("Support Resistance")) return 61;

  return 60;
}

function calculateProfitFactorScore(strategyName: string): number {
  if (strategyName.includes("Liquidity Sweep")) return 82;
  if (strategyName.includes("News Volatility")) return 74;
  if (strategyName.includes("Trend Pullback")) return 80;
  if (strategyName.includes("Breakout")) return 68;
  if (strategyName.includes("Mean Reversion")) return 63;
  if (strategyName.includes("Orderblock")) return 76;
  if (strategyName.includes("Fair Value Gap")) return 71;
  if (strategyName.includes("Opening Range")) return 67;
  if (strategyName.includes("Support Resistance")) return 62;

  return 60;
}

function calculateDrawdownScore(strategyName: string): number {
  if (strategyName.includes("Liquidity Sweep")) return 68;
  if (strategyName.includes("News Volatility")) return 55;
  if (strategyName.includes("Trend Pullback")) return 78;
  if (strategyName.includes("Breakout")) return 66;
  if (strategyName.includes("Mean Reversion")) return 64;
  if (strategyName.includes("Orderblock")) return 72;
  if (strategyName.includes("Fair Value Gap")) return 63;
  if (strategyName.includes("Opening Range")) return 65;
  if (strategyName.includes("Support Resistance")) return 70;

  return 60;
}

function calculateMarketFitScore(params: {
  marketMatch: boolean;
  symbolMatch: boolean;
  testPriority: number;
}): number {
  let score = 50;

  if (params.marketMatch) score += 20;
  if (params.symbolMatch) score += 15;

  score += Math.round(params.testPriority * 0.15);

  return clamp(score, 0, 100);
}

function calculateRiskFitScore(params: {
  riskTags: string[];
  brokerSensitivity: "LOW" | "MEDIUM" | "HIGH";
}): number {
  let score = 80;

  if (params.riskTags.length >= 3) score -= 8;
  if (params.brokerSensitivity === "HIGH") score -= 8;
  if (params.brokerSensitivity === "LOW") score += 5;

  if (params.riskTags.some((tag) => tag.toLowerCase().includes("news"))) {
    score -= 6;
  }

  if (params.riskTags.some((tag) => tag.toLowerCase().includes("slippage"))) {
    score -= 5;
  }

  return clamp(score, 0, 100);
}

function getBrokerFitScore(params: {
  strategyName: string;
  symbol: string;
  tradingStyle: string;
}): number {
  const brokerIntel = generateStrategyBrokerIntelligenceReport();

  const recommendation = brokerIntel.recommendations.find(
    (item) =>
      item.symbol === params.symbol &&
      item.tradingStyle === params.tradingStyle &&
      item.strategyName === params.strategyName
  );

  return recommendation?.bestMatchScore ?? 55;
}

function calculateConfidenceScore(params: {
  testPriority: number;
  brokerFitScore: number;
  marketFitScore: number;
  riskFitScore: number;
}): number {
  return clamp(
    round0(
      params.testPriority * 0.25 +
        params.brokerFitScore * 0.3 +
        params.marketFitScore * 0.25 +
        params.riskFitScore * 0.2
    ),
    0,
    100
  );
}

function calculateFinalStrategyScore(params: {
  winRateScore: number;
  profitFactorScore: number;
  drawdownScore: number;
  marketFitScore: number;
  brokerFitScore: number;
  riskFitScore: number;
  confidenceScore: number;
}): number {
  return clamp(
    round0(
      params.winRateScore * 0.18 +
        params.profitFactorScore * 0.2 +
        params.drawdownScore * 0.14 +
        params.marketFitScore * 0.16 +
        params.brokerFitScore * 0.14 +
        params.riskFitScore * 0.08 +
        params.confidenceScore * 0.1
    ),
    0,
    100
  );
}

function resolveStatus(score: number): StrategyRankingStatus {
  if (score >= 78) return "TOP_RANKED";
  if (score >= 65) return "READY";
  if (score >= 55) return "WATCHLIST";
  return "BLOCKED";
}

function resolveRecommendation(
  score: number
): "TOP_STRATEGY" | "VALID_STRATEGY" | "WATCHLIST" | "AVOID" {
  if (score >= 78) return "TOP_STRATEGY";
  if (score >= 65) return "VALID_STRATEGY";
  if (score >= 55) return "WATCHLIST";
  return "AVOID";
}

function buildReasons(params: {
  strategyName: string;
  finalStrategyScore: number;
  winRateScore: number;
  profitFactorScore: number;
  brokerFitScore: number;
  marketFitScore: number;
  recommendation: string;
}): string[] {
  return [
    `${params.strategyName} final strategy score is ${params.finalStrategyScore}.`,
    `Win rate score ${params.winRateScore}, profit factor score ${params.profitFactorScore}.`,
    `Market fit ${params.marketFitScore}, broker fit ${params.brokerFitScore}.`,
    `Recommendation resolved as ${params.recommendation}.`,
  ];
}

function buildRankingProfiles(): StrategyRankingProfile[] {
  const registry = generateStrategyUniverseRegistryReport();

  const profiles = registry.strategyUniverse.flatMap((strategy) => {
    return strategy.preferredMarkets.flatMap((market) => {
      return strategy.preferredSymbols.flatMap((symbol) => {
        return strategy.supportedTradingStyles.map((tradingStyle) => {
          const winRateScore = calculateWinRateScore(strategy.strategyName);
          const profitFactorScore = calculateProfitFactorScore(
            strategy.strategyName
          );
          const drawdownScore = calculateDrawdownScore(strategy.strategyName);
          const marketFitScore = calculateMarketFitScore({
            marketMatch: strategy.preferredMarkets.includes(market),
            symbolMatch: strategy.preferredSymbols.includes(symbol),
            testPriority: strategy.testPriority,
          });
          const brokerFitScore = getBrokerFitScore({
            strategyName: strategy.strategyName,
            symbol,
            tradingStyle,
          });
          const riskFitScore = calculateRiskFitScore({
            riskTags: strategy.riskTags,
            brokerSensitivity: strategy.brokerSensitivity,
          });
          const confidenceScore = calculateConfidenceScore({
            testPriority: strategy.testPriority,
            brokerFitScore,
            marketFitScore,
            riskFitScore,
          });
          const finalStrategyScore = calculateFinalStrategyScore({
            winRateScore,
            profitFactorScore,
            drawdownScore,
            marketFitScore,
            brokerFitScore,
            riskFitScore,
            confidenceScore,
          });
          const status = resolveStatus(finalStrategyScore);
          const recommendation = resolveRecommendation(finalStrategyScore);

          return {
            strategyId: strategy.strategyId,
            strategyType: strategy.strategyType,
            strategyName: strategy.strategyName,
            market,
            symbol,
            tradingStyle,
            complexity: strategy.complexity,
            enabled: strategy.enabled,
            testPriority: strategy.testPriority,
            winRateScore,
            profitFactorScore,
            drawdownScore,
            marketFitScore,
            brokerFitScore,
            riskFitScore,
            confidenceScore,
            finalStrategyScore,
            rank: 0,
            status,
            recommendation,
            reasons: buildReasons({
              strategyName: strategy.strategyName,
              finalStrategyScore,
              winRateScore,
              profitFactorScore,
              brokerFitScore,
              marketFitScore,
              recommendation,
            }),
          } satisfies StrategyRankingProfile;
        });
      });
    });
  });

  return profiles
    .sort((a, b) => b.finalStrategyScore - a.finalStrategyScore)
    .map((profile, index) => ({
      ...profile,
      rank: index + 1,
    }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildMarketRankings(
  profiles: StrategyRankingProfile[]
): MarketStrategyRanking[] {
  const keys = Array.from(
    new Set(profiles.map((profile) => `${profile.market}|${profile.symbol}`))
  );

  return keys
    .map((key) => {
      const [market, symbol] = key.split("|") as [
        StrategyRankingProfile["market"],
        string,
      ];

      const rankedStrategies = profiles
        .filter(
          (profile) => profile.market === market && profile.symbol === symbol
        )
        .sort((a, b) => b.finalStrategyScore - a.finalStrategyScore);

      const top = rankedStrategies[0];

      return {
        market,
        symbol,
        totalRankedStrategies: rankedStrategies.length,
        topStrategyId: top?.strategyId ?? "NONE",
        topStrategyName: top?.strategyName ?? "NONE",
        topStrategyScore: top?.finalStrategyScore ?? 0,
        averageStrategyScore: round0(
          average(rankedStrategies.map((profile) => profile.finalStrategyScore))
        ),
        rankedStrategies: rankedStrategies.slice(0, 8),
      };
    })
    .sort((a, b) => b.topStrategyScore - a.topStrategyScore);
}

function resolveReportStatus(
  profiles: StrategyRankingProfile[]
): StrategyRankingStatus {
  if (profiles.every((profile) => profile.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (profiles.some((profile) => profile.status === "TOP_RANKED")) {
    return "TOP_RANKED";
  }

  if (profiles.some((profile) => profile.status === "READY")) {
    return "READY";
  }

  return "WATCHLIST";
}

function buildRankingNotes(profiles: StrategyRankingProfile[]): string[] {
  return profiles.slice(0, 8).map((profile) => {
    return `#${profile.rank} ${profile.strategyName} ${profile.symbol} ${profile.tradingStyle}: score ${profile.finalStrategyScore}, recommendation ${profile.recommendation}.`;
  });
}

export function generateStrategyRankingReport(): StrategyRankingReport {
  const rankingProfiles = buildRankingProfiles();
  const marketRankings = buildMarketRankings(rankingProfiles);

  const top = rankingProfiles[0];
  const weakest = rankingProfiles[rankingProfiles.length - 1];

  return {
    version: VERSION,
    status: resolveReportStatus(rankingProfiles),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalStrategiesRanked: rankingProfiles.length,
    topStrategyOverall: top
      ? `${top.strategyName} ${top.symbol} ${top.tradingStyle}`
      : "NONE",
    weakestStrategyOverall: weakest
      ? `${weakest.strategyName} ${weakest.symbol} ${weakest.tradingStyle}`
      : "NONE",
    marketRankings,
    rankingProfiles,
    summary:
      "Strategy Ranking Engine ranked the strategy universe across markets, symbols and trading styles using performance, risk, market fit, broker fit and confidence.",
    rankingNotes: buildRankingNotes(rankingProfiles),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      rankingMode: "SIMULATED_STRATEGY_RANKING",
    },
    createdAt: new Date().toISOString(),
  };
}
