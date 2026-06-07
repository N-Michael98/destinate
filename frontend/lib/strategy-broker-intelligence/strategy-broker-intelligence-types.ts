import { BrokerId, TradingStyle } from "../smart-broker-selection";
import { MarketCategory } from "../broker-performance-memory";

export type StrategyBrokerIntelligenceStatus =
  | "READY"
  | "MATCHED"
  | "WATCHLIST"
  | "BLOCKED";

export type StrategyBrokerIntelligenceMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type StrategyType =
  | "LIQUIDITY_SWEEP_SCALPING"
  | "BREAKOUT_DAYTRADING"
  | "TREND_PULLBACK_SWING"
  | "MEAN_REVERSION_DAYTRADING"
  | "NEWS_VOLATILITY_SCALPING";

export interface StrategyBrokerMatchProfile {
  id: string;
  strategyType: StrategyType;
  strategyName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  brokerId: BrokerId;
  brokerName: string;
  brokerPerformanceScore: number;
  brokerConfidenceScore: number;
  strategySuccessRate: number;
  strategyProfitFactor: number;
  strategyDrawdownPercent: number;
  brokerSuitabilityScore: number;
  finalMatchScore: number;
  status: StrategyBrokerIntelligenceStatus;
  recommendation: "BEST_MATCH" | "GOOD_MATCH" | "WATCHLIST" | "AVOID";
  reasons: string[];
}

export interface StrategyBrokerRecommendation {
  strategyType: StrategyType;
  strategyName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  preferredBroker: BrokerId | "NONE";
  preferredBrokerName: string;
  bestMatchScore: number;
  alternativeBroker: BrokerId | "NONE";
  alternativeBrokerName: string;
  alternativeMatchScore: number;
  recommendationReason: string;
}

export interface StrategyBrokerIntelligenceReport {
  version: "V12.9.0";
  status: StrategyBrokerIntelligenceStatus;
  mode: StrategyBrokerIntelligenceMode[];
  totalMatches: number;
  totalRecommendations: number;
  strongestMatch: string;
  weakestMatch: string;
  matchProfiles: StrategyBrokerMatchProfile[];
  recommendations: StrategyBrokerRecommendation[];
  summary: string;
  intelligenceNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    intelligenceMode: "SIMULATED_STRATEGY_BROKER_MATCHING";
  };
  createdAt: string;
}
