export type PaperAccountRiskMode =
  | "LOW_RISK"
  | "NORMAL_RISK"
  | "ELEVATED_RISK"
  | "HIGH_RISK"
  | "BLOCKED";

export type PaperPositionAccountSnapshot = {
  id: string;
  symbol: string;
  direction: string;
  entry: number;
  currentPrice: number;
  stopLoss: number;
  size: number;
  exposureValue: number;
  openRiskAmount: number;
  unrealizedPnL: number;
  status: string;
};

export type PaperPositionAccountSyncReport = {
  version: "V16.2.1";
  status: "READY";
  mode: "SIMULATION";
  accountCurrency: string;
  balance: number;
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  openPositions: number;
  totalExposureValue: number;
  totalOpenRiskAmount: number;
  exposurePercent: number;
  openRiskPercent: number;
  usedMargin: number;
  freeMargin: number;
  marginUsagePercent: number;
  riskMode: PaperAccountRiskMode;
  liveExecutionEnabled: false;
  positions: PaperPositionAccountSnapshot[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
