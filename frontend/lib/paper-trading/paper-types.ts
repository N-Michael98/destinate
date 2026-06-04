export type PaperDirection =
  | "BUY"
  | "SELL";

export type PaperOrderStatus =
  | "PENDING"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED";

export type PaperPositionStatus =
  | "OPEN"
  | "CLOSED";

export type PaperOrder = {
  id: string;

  symbol: string;
  direction: PaperDirection;

  entry: number;
  stopLoss: number;

  takeProfit1: number;
  takeProfit2: number;

  confidence: number;

  status: PaperOrderStatus;

  reason: string;

  createdAt: string;
};

export type PaperPosition = {
  id: string;

  orderId: string;

  symbol: string;
  direction: PaperDirection;

  entry: number;
  currentPrice: number;

  stopLoss: number;

  takeProfit1: number;
  takeProfit2: number;

  size: number;

  unrealizedPnL: number;

  status: PaperPositionStatus;

  openedAt: string;
  closedAt?: string;
};

export type PaperAccount = {
  balance: number;
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  openPositions: number;
  currency: string;
  updatedAt: string;
};