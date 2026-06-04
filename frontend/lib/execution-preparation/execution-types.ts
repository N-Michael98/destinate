export type ExecutionTicket = {
  symbol: string;

  direction: "BUY" | "SELL";

  entry: number;
  stopLoss: number;

  takeProfit1: number;
  takeProfit2: number;

  confidence: number;

  approved: boolean;

  reason: string;

  createdAt: string;
};