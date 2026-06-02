export type TradeMemoryEntry = {
  id: string;
  market: string;
  strategy: string;
  direction: "LONG" | "SHORT";
  resultPercent: number;
  resultAmount: number;
  timestamp: string;
};

export type StrategyMemoryEntry = {
  strategy: string;
  totalTrades: number;
  wins: number;
  losses: number;
  averageReturn: number;
  confidenceScore: number;
};

export type MarketMemoryEntry = {
  market: string;
  totalTrades: number;
  averageReturn: number;
  bestStrategy: string;
};

export type LearningMemoryStatus =
  | "EMPTY"
  | "LEARNING"
  | "ACTIVE";