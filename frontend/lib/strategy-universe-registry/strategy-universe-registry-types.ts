import { TradingStyle } from "../smart-broker-selection";
import { MarketCategory } from "../broker-performance-memory";
import { StrategyType } from "../strategy-broker-intelligence";

export type StrategyUniverseRegistryStatus =
  | "READY"
  | "ACTIVE"
  | "WATCHLIST"
  | "DISABLED";

export type StrategyUniverseRegistryMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type StrategyComplexity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "INSTITUTIONAL";

export type StrategyTimeHorizon =
  | "INTRADAY"
  | "MULTI_DAY"
  | "MULTI_WEEK";

export interface StrategyUniverseItem {
  strategyId: string;
  strategyType: StrategyType;
  strategyName: string;
  description: string;
  enabled: boolean;
  status: StrategyUniverseRegistryStatus;
  complexity: StrategyComplexity;
  preferredMarkets: MarketCategory[];
  preferredSymbols: string[];
  supportedTradingStyles: TradingStyle[];
  timeHorizon: StrategyTimeHorizon;
  requiredTimeframes: string[];
  signalInputs: string[];
  confirmationInputs: string[];
  riskTags: string[];
  brokerSensitivity: "LOW" | "MEDIUM" | "HIGH";
  testPriority: number;
  notes: string[];
}

export interface StrategyMarketCoverage {
  market: MarketCategory;
  symbol: string;
  totalStrategies: number;
  activeStrategies: number;
  scalpingStrategies: number;
  daytradingStrategies: number;
  swingStrategies: number;
  strategyNames: string[];
}

export interface StrategyUniverseRegistryReport {
  version: "V12.9.2";
  status: StrategyUniverseRegistryStatus;
  mode: StrategyUniverseRegistryMode[];
  totalStrategies: number;
  activeStrategies: number;
  watchlistStrategies: number;
  disabledStrategies: number;
  strategyUniverse: StrategyUniverseItem[];
  marketCoverage: StrategyMarketCoverage[];
  summary: string;
  registryNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    registryMode: "SIMULATED_STRATEGY_UNIVERSE_REGISTRY";
  };
  createdAt: string;
}
