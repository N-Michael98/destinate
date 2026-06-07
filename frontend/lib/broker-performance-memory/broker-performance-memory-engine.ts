import { generateBrokerReputationMemoryReport } from "../broker-reputation-memory";
import { BrokerId, TradingStyle } from "../smart-broker-selection";

import {
  BrokerMarketStylePerformance,
  BrokerPerformanceMemoryReport,
  BrokerPerformanceMemoryStatus,
  BrokerPerformanceSummary,
  MarketCategory,
} from "./broker-performance-memory-types";

const VERSION = "V12.8.0" as const;

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

function getReputationScore(brokerId: BrokerId): number {
  const reputationReport = generateBrokerReputationMemoryReport();
  const memory = reputationReport.reputationMemories.find(
    (item) => item.brokerId === brokerId
  );

  return memory?.reputationScore ?? 70;
}

function getExecutionQualityScore(brokerId: BrokerId): number {
  const reputationReport = generateBrokerReputationMemoryReport();
  const memory = reputationReport.reputationMemories.find(
    (item) => item.brokerId === brokerId
  );

  return memory?.memorySignals.executionQualityScore ?? 75;
}

function calculatePerformanceScore(params: {
  winRate: number;
  profitFactor: number;
  averageRR: number;
  averagePnlPercent: number;
  maxDrawdownPercent: number;
  executionQualityScore: number;
  reputationScore: number;
}): number {
  const profitFactorScore = clamp(params.profitFactor * 35, 0, 100);
  const rrScore = clamp(params.averageRR * 35, 0, 100);
  const pnlScore = clamp(50 + params.averagePnlPercent * 10, 0, 100);
  const drawdownScore = clamp(100 - params.maxDrawdownPercent * 6, 0, 100);

  return clamp(
    round0(
      params.winRate * 0.22 +
        profitFactorScore * 0.2 +
        rrScore * 0.16 +
        pnlScore * 0.12 +
        drawdownScore * 0.12 +
        params.executionQualityScore * 0.1 +
        params.reputationScore * 0.08
    ),
    0,
    100
  );
}

function calculateConfidenceScore(params: {
  totalTrades: number;
  performanceScore: number;
  reputationScore: number;
  executionQualityScore: number;
}): number {
  const sampleScore = clamp(params.totalTrades / 5, 0, 100);

  return clamp(
    round0(
      sampleScore * 0.25 +
        params.performanceScore * 0.35 +
        params.reputationScore * 0.25 +
        params.executionQualityScore * 0.15
    ),
    0,
    100
  );
}

function resolveStatus(score: number): BrokerPerformanceMemoryStatus {
  if (score >= 85) return "PREFERRED";
  if (score >= 72) return "READY";
  if (score >= 60) return "NEUTRAL";
  if (score >= 45) return "UNDERPERFORMING";
  return "BLOCKED";
}

function resolveRecommendation(
  status: BrokerPerformanceMemoryStatus
): "PREFERRED" | "ACCEPTABLE" | "WATCHLIST" | "AVOID" {
  if (status === "PREFERRED") return "PREFERRED";
  if (status === "READY") return "ACCEPTABLE";
  if (status === "NEUTRAL" || status === "UNDERPERFORMING") return "WATCHLIST";
  return "AVOID";
}

function buildReasons(params: {
  brokerName: string;
  market: MarketCategory;
  tradingStyle: TradingStyle;
  winRate: number;
  profitFactor: number;
  performanceScore: number;
  recommendation: string;
}): string[] {
  return [
    `${params.brokerName} ${params.market} ${params.tradingStyle} performance score is ${params.performanceScore}.`,
    `Win rate ${params.winRate}% with profit factor ${params.profitFactor}.`,
    `Recommendation resolved as ${params.recommendation}.`,
  ];
}

function createProfile(input: {
  brokerId: BrokerId;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  totalTrades: number;
  wins: number;
  losses: number;
  averageRR: number;
  profitFactor: number;
  averagePnlPercent: number;
  maxDrawdownPercent: number;
}): BrokerMarketStylePerformance {
  const brokerName = getBrokerName(input.brokerId);
  const winRate = round0((input.wins / input.totalTrades) * 100);
  const executionQualityScore = getExecutionQualityScore(input.brokerId);
  const reputationScore = getReputationScore(input.brokerId);

  const performanceScore = calculatePerformanceScore({
    winRate,
    profitFactor: input.profitFactor,
    averageRR: input.averageRR,
    averagePnlPercent: input.averagePnlPercent,
    maxDrawdownPercent: input.maxDrawdownPercent,
    executionQualityScore,
    reputationScore,
  });

  const confidenceScore = calculateConfidenceScore({
    totalTrades: input.totalTrades,
    performanceScore,
    reputationScore,
    executionQualityScore,
  });

  const status = resolveStatus(performanceScore);
  const recommendation = resolveRecommendation(status);

  return {
    brokerId: input.brokerId,
    brokerName,
    market: input.market,
    symbol: input.symbol,
    tradingStyle: input.tradingStyle,
    totalTrades: input.totalTrades,
    wins: input.wins,
    losses: input.losses,
    winRate,
    averageRR: input.averageRR,
    profitFactor: input.profitFactor,
    averagePnlPercent: input.averagePnlPercent,
    maxDrawdownPercent: input.maxDrawdownPercent,
    executionQualityScore,
    reputationScore,
    performanceScore,
    confidenceScore,
    status,
    recommendation,
    reasons: buildReasons({
      brokerName,
      market: input.market,
      tradingStyle: input.tradingStyle,
      winRate,
      profitFactor: input.profitFactor,
      performanceScore,
      recommendation,
    }),
  };
}

function buildPerformanceProfiles(): BrokerMarketStylePerformance[] {
  return [
    createProfile({
      brokerId: "IC_MARKETS",
      market: "GOLD",
      symbol: "XAUUSD",
      tradingStyle: "SCALPING",
      totalTrades: 420,
      wins: 265,
      losses: 155,
      averageRR: 2.4,
      profitFactor: 1.82,
      averagePnlPercent: 1.9,
      maxDrawdownPercent: 6.2,
    }),
    createProfile({
      brokerId: "CAPITAL_COM",
      market: "GOLD",
      symbol: "XAUUSD",
      tradingStyle: "SCALPING",
      totalTrades: 420,
      wins: 227,
      losses: 193,
      averageRR: 1.7,
      profitFactor: 1.31,
      averagePnlPercent: 1.1,
      maxDrawdownPercent: 9.4,
    }),
    createProfile({
      brokerId: "CAPITAL_COM",
      market: "FOREX",
      symbol: "EURUSD",
      tradingStyle: "SWING",
      totalTrades: 280,
      wins: 188,
      losses: 92,
      averageRR: 2.2,
      profitFactor: 1.76,
      averagePnlPercent: 1.6,
      maxDrawdownPercent: 5.8,
    }),
    createProfile({
      brokerId: "IC_MARKETS",
      market: "FOREX",
      symbol: "EURUSD",
      tradingStyle: "SWING",
      totalTrades: 280,
      wins: 162,
      losses: 118,
      averageRR: 1.8,
      profitFactor: 1.42,
      averagePnlPercent: 1.2,
      maxDrawdownPercent: 7.4,
    }),
    createProfile({
      brokerId: "IC_MARKETS",
      market: "INDICES",
      symbol: "NAS100",
      tradingStyle: "DAYTRADING",
      totalTrades: 310,
      wins: 186,
      losses: 124,
      averageRR: 2.0,
      profitFactor: 1.55,
      averagePnlPercent: 1.4,
      maxDrawdownPercent: 7.0,
    }),
    createProfile({
      brokerId: "CAPITAL_COM",
      market: "INDICES",
      symbol: "NAS100",
      tradingStyle: "DAYTRADING",
      totalTrades: 310,
      wins: 195,
      losses: 115,
      averageRR: 2.1,
      profitFactor: 1.63,
      averagePnlPercent: 1.5,
      maxDrawdownPercent: 6.6,
    }),
  ].sort((a, b) => b.performanceScore - a.performanceScore);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildBrokerSummaries(
  profiles: BrokerMarketStylePerformance[]
): BrokerPerformanceSummary[] {
  const brokerIds: BrokerId[] = ["IC_MARKETS", "CAPITAL_COM"];

  return brokerIds
    .map((brokerId) => {
      const brokerProfiles = profiles.filter(
        (profile) => profile.brokerId === brokerId
      );

      const bestProfile = [...brokerProfiles].sort(
        (a, b) => b.performanceScore - a.performanceScore
      )[0];

      const averagePerformanceScore = round0(
        average(brokerProfiles.map((profile) => profile.performanceScore))
      );

      const status = resolveStatus(averagePerformanceScore);

      return {
        brokerId,
        brokerName: getBrokerName(brokerId),
        totalProfiles: brokerProfiles.length,
        preferredProfiles: brokerProfiles.filter(
          (profile) => profile.recommendation === "PREFERRED"
        ).length,
        averagePerformanceScore,
        averageWinRate: round0(
          average(brokerProfiles.map((profile) => profile.winRate))
        ),
        averageProfitFactor: round2(
          average(brokerProfiles.map((profile) => profile.profitFactor))
        ),
        bestMarket: bestProfile.market,
        bestTradingStyle: bestProfile.tradingStyle,
        status,
      };
    })
    .sort((a, b) => b.averagePerformanceScore - a.averagePerformanceScore);
}

function resolveReportStatus(
  summaries: BrokerPerformanceSummary[]
): BrokerPerformanceMemoryStatus {
  if (summaries.every((summary) => summary.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (summaries.some((summary) => summary.status === "PREFERRED")) {
    return "PREFERRED";
  }

  if (summaries.some((summary) => summary.status === "READY")) {
    return "READY";
  }

  return "NEUTRAL";
}

function resolvePreferredBroker(
  summaries: BrokerPerformanceSummary[]
): BrokerId | "NONE" {
  const best = summaries[0];

  if (!best || best.averagePerformanceScore <= 0) return "NONE";

  return best.brokerId;
}

function buildMemoryNotes(profiles: BrokerMarketStylePerformance[]): string[] {
  return profiles.slice(0, 6).map((profile) => {
    return `${profile.brokerName} is ${profile.recommendation} for ${profile.symbol} ${profile.tradingStyle} with performance score ${profile.performanceScore}.`;
  });
}

export function generateBrokerPerformanceMemoryReport(): BrokerPerformanceMemoryReport {
  const performanceProfiles = buildPerformanceProfiles();
  const brokerSummaries = buildBrokerSummaries(performanceProfiles);

  const strongestProfile = performanceProfiles[0];
  const weakestProfile = performanceProfiles[performanceProfiles.length - 1];

  return {
    version: VERSION,
    status: resolveReportStatus(brokerSummaries),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalProfiles: performanceProfiles.length,
    preferredBroker: resolvePreferredBroker(brokerSummaries),
    strongestProfile: strongestProfile
      ? `${strongestProfile.brokerName} ${strongestProfile.symbol} ${strongestProfile.tradingStyle}`
      : "NONE",
    weakestProfile: weakestProfile
      ? `${weakestProfile.brokerName} ${weakestProfile.symbol} ${weakestProfile.tradingStyle}`
      : "NONE",
    performanceProfiles,
    brokerSummaries,
    summary:
      "Broker Performance Memory created simulated market-style performance memory for broker selection and future strategy-broker matching.",
    memoryNotes: buildMemoryNotes(performanceProfiles),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      memoryMode: "SIMULATED_BROKER_PERFORMANCE_MEMORY",
    },
    createdAt: new Date().toISOString(),
  };
}
