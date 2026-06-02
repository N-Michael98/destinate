export type TradeResult = {
  id: string;
  market: string;
  strategy: string;
  resultR: number;
  outcome: "WIN" | "LOSS";
};

export type PerformanceSummary = {
  winrate: number;
  profitFactor: number;
  averageReturn: number;
  maxDrawdown: number;
};