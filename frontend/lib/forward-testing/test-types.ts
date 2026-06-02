export type ForwardTestStatus =
  | "PLANNED"
  | "RUNNING"
  | "COMPLETED"
  | "CANCELLED";

export type ForwardTradeDirection =
  | "LONG"
  | "SHORT";

export type ForwardTestPlan = {
  id: string;
  market: string;
  strategy: string;
  direction: ForwardTradeDirection;
  confidence: number;
  plannedAt: string;
  status: ForwardTestStatus;
};

export type ForwardTestResult = {
  id: string;
  planId: string;
  profitLossPercent: number;
  profitLossAmount: number;
  completedAt: string;
};

export type StrategyPerformance = {
  strategy: string;
  totalTests: number;
  wins: number;
  losses: number;
  winRate: number;
  averageReturn: number;
};