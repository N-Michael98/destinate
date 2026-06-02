export type DemoOrder = {
  id: string;
  market: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
};

export type ExecutionStatus =
  | "PENDING"
  | "EXECUTED"
  | "CLOSED";