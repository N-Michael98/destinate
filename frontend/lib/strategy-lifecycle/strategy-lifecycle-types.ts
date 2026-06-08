export type StrategyLifecycleStatus =
  | "PROMOTED"
  | "ACTIVE"
  | "WATCHLIST"
  | "DEGRADED"
  | "ARCHIVED";

export interface StrategyLifecycleEntry {
  strategyId: string;
  strategyName: string;
  symbol: string;
  market: string;
  lifecycleStatus: StrategyLifecycleStatus;
  lifecycleScore: number;
  competitionScore: number;
  decisionConfidence: number;
  reason: string;
}

export interface StrategyLifecycleReport {
  version: "V13.2.0";
  status: "READY";
  totalStrategies: number;
  promotedStrategies: number;
  activeStrategies: number;
  watchlistStrategies: number;
  degradedStrategies: number;
  archivedStrategies: number;
  entries: StrategyLifecycleEntry[];
  summary: string;
  createdAt: string;
}
