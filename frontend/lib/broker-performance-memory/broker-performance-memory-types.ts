import { BrokerId, TradingStyle } from "../smart-broker-selection";

export type BrokerPerformanceMemoryStatus =
  | "READY"
  | "PREFERRED"
  | "NEUTRAL"
  | "UNDERPERFORMING"
  | "BLOCKED";

export type BrokerPerformanceMemoryMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type MarketCategory =
  | "GOLD"
  | "FOREX"
  | "INDICES"
  | "CRYPTO"
  | "COMMODITIES";

export interface BrokerMarketStylePerformance {
  brokerId: BrokerId;
  brokerName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  averageRR: number;
  profitFactor: number;
  averagePnlPercent: number;
  maxDrawdownPercent: number;
  executionQualityScore: number;
  reputationScore: number;
  performanceScore: number;
  confidenceScore: number;
  status: BrokerPerformanceMemoryStatus;
  recommendation: "PREFERRED" | "ACCEPTABLE" | "WATCHLIST" | "AVOID";
  reasons: string[];
}

export interface BrokerPerformanceSummary {
  brokerId: BrokerId;
  brokerName: string;
  totalProfiles: number;
  preferredProfiles: number;
  averagePerformanceScore: number;
  averageWinRate: number;
  averageProfitFactor: number;
  bestMarket: MarketCategory;
  bestTradingStyle: TradingStyle;
  status: BrokerPerformanceMemoryStatus;
}

export interface BrokerPerformanceMemoryReport {
  version: "V12.8.0";
  status: BrokerPerformanceMemoryStatus;
  mode: BrokerPerformanceMemoryMode[];
  totalProfiles: number;
  preferredBroker: BrokerId | "NONE";
  strongestProfile: string;
  weakestProfile: string;
  performanceProfiles: BrokerMarketStylePerformance[];
  brokerSummaries: BrokerPerformanceSummary[];
  summary: string;
  memoryNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    memoryMode: "SIMULATED_BROKER_PERFORMANCE_MEMORY";
  };
  createdAt: string;
}
