export type ForwardTestStatus =
  | "RUNNING"
  | "COMPLETED"
  | "WAITING_FOR_DATA"
  | "BLOCKED";

export type ForwardTestOutcome = "WIN" | "LOSS" | "BREAKEVEN" | "PENDING";

export interface ForwardTestSignal {
  signalId: string;
  symbol: string;
  side: "BUY" | "SELL";
  tradingStyle: string;
  confidenceScore: number;
  evolvedLotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  expectedRR: number;
  generatedAt: string;
}

export interface ForwardTestResult {
  resultId: string;
  signalId: string;
  symbol: string;
  side: "BUY" | "SELL";
  tradingStyle: string;
  confidenceScore: number;
  evolvedLotSize: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  actualRR: number;
  expectedRR: number;
  pnlPercent: number;
  outcome: ForwardTestOutcome;
  hitTarget: boolean;
  hitStop: boolean;
  barsHeld: number;
  slippagePercent: number;
  note: string;
}

export interface ForwardTestingMetrics {
  totalSignals: number;
  completedTrades: number;
  pendingTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgRR: number;
  profitFactor: number;
  expectedValuePerTrade: number;
  totalPnlPercent: number;
  avgConfidenceScore: number;
  avgEvolvedLotSize: number;
  bestTrade: string;
  worstTrade: string;
}

export interface ForwardTestingReport {
  version: "V16.4.0";
  status: ForwardTestStatus;
  mode: "FORWARD_TEST" | "SIMULATION" | "READ_ONLY";
  sessionId: string;
  signals: ForwardTestSignal[];
  results: ForwardTestResult[];
  metrics: ForwardTestingMetrics;
  loopSource: string;
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    forwardTestMode: "WALK_FORWARD_SIMULATION";
  };
  createdAt: string;
}
