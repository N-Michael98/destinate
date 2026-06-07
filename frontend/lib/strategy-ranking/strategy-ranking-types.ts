import { TradingStyle } from "../smart-broker-selection";
import { MarketCategory } from "../broker-performance-memory";
import { StrategyType } from "../strategy-broker-intelligence";
import { StrategyComplexity } from "../strategy-universe-registry";

export type StrategyRankingStatus =
  | "READY"
  | "TOP_RANKED"
  | "WATCHLIST"
  | "BLOCKED";

export type StrategyRankingMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export interface StrategyRankingProfile {
  strategyId: string;
  strategyType: StrategyType;
  strategyName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  complexity: StrategyComplexity;
  enabled: boolean;
  testPriority: number;
  winRateScore: number;
  profitFactorScore: number;
  drawdownScore: number;
  marketFitScore: number;
  brokerFitScore: number;
  riskFitScore: number;
  confidenceScore: number;
  finalStrategyScore: number;
  rank: number;
  status: StrategyRankingStatus;
  recommendation: "TOP_STRATEGY" | "VALID_STRATEGY" | "WATCHLIST" | "AVOID";
  reasons: string[];
}

export interface MarketStrategyRanking {
  market: MarketCategory;
  symbol: string;
  totalRankedStrategies: number;
  topStrategyId: string;
  topStrategyName: string;
  topStrategyScore: number;
  averageStrategyScore: number;
  rankedStrategies: StrategyRankingProfile[];
}

export interface StrategyRankingReport {
  version: "V13.0.0";
  status: StrategyRankingStatus;
  mode: StrategyRankingMode[];
  totalStrategiesRanked: number;
  topStrategyOverall: string;
  weakestStrategyOverall: string;
  marketRankings: MarketStrategyRanking[];
  rankingProfiles: StrategyRankingProfile[];
  summary: string;
  rankingNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    rankingMode: "SIMULATED_STRATEGY_RANKING";
  };
  createdAt: string;
}
