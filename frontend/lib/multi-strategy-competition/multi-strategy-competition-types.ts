import { TradingStyle } from "../smart-broker-selection";
import { MarketCategory } from "../broker-performance-memory";
import { StrategyType } from "../strategy-broker-intelligence";

export type MultiStrategyCompetitionStatus =
  | "READY"
  | "WINNER_SELECTED"
  | "NO_CLEAR_WINNER"
  | "WATCHLIST"
  | "BLOCKED";

export type MultiStrategyCompetitionMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export interface StrategyCompetitor {
  strategyId: string;
  strategyType: StrategyType;
  strategyName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  originalRank: number;
  finalStrategyScore: number;
  winRateScore: number;
  profitFactorScore: number;
  drawdownScore: number;
  marketFitScore: number;
  brokerFitScore: number;
  riskFitScore: number;
  confidenceScore: number;
  competitionScore: number;
  competitionPosition: number;
  status: MultiStrategyCompetitionStatus;
  recommendation: "WINNER" | "RUNNER_UP" | "VALID" | "WATCHLIST" | "AVOID";
  reasons: string[];
}

export interface MarketStrategyCompetition {
  market: MarketCategory;
  symbol: string;
  totalCompetitors: number;
  winnerStrategyId: string;
  winnerStrategyName: string;
  winnerTradingStyle: TradingStyle;
  winnerScore: number;
  runnerUpStrategyId: string;
  runnerUpStrategyName: string;
  runnerUpScore: number;
  scoreGap: number;
  decisionConfidence: number;
  status: MultiStrategyCompetitionStatus;
  competitors: StrategyCompetitor[];
  reasons: string[];
}

export interface MultiStrategyCompetitionReport {
  version: "V13.1.0";
  status: MultiStrategyCompetitionStatus;
  mode: MultiStrategyCompetitionMode[];
  totalMarkets: number;
  totalCompetitors: number;
  winnersSelected: number;
  noClearWinnerMarkets: number;
  strongestWinner: string;
  weakestWinner: string;
  competitions: MarketStrategyCompetition[];
  globalTopCompetitors: StrategyCompetitor[];
  summary: string;
  competitionNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    competitionMode: "SIMULATED_MULTI_STRATEGY_COMPETITION";
  };
  createdAt: string;
}
