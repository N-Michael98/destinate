export type PaperPerformanceRiskGrade =
  | "EXCELLENT"
  | "GOOD"
  | "NEUTRAL"
  | "WEAK"
  | "BLOCKED";

export type PaperAccountPerformanceSyncReport = {
  version: "V16.2.2";
  status: "READY";
  mode: "SIMULATION";

  accountBalance: number;
  accountEquity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  netPnL: number;
  returnPercent: number;

  openPositions: number;
  totalExposureValue: number;
  totalOpenRiskAmount: number;
  exposurePercent: number;
  openRiskPercent: number;
  usedMargin: number;
  freeMargin: number;
  marginUsagePercent: number;

  totalHistoryEvents: number;
  orderCreatedEvents: number;
  orderFilledEvents: number;
  positionOpenedEvents: number;
  positionUpdatedEvents: number;
  positionClosedEvents: number;

  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  lossRate: number;
  profitFactor: number;
  averagePnL: number;
  bestPnL: number;
  worstPnL: number;

  performanceScore: number;
  riskGrade: PaperPerformanceRiskGrade;
  liveExecutionEnabled: false;

  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
