export type ExecutionTicketPaperOrderStatus =
  | "PAPER_ORDER_CREATED"
  | "PAPER_ORDER_WAITING"
  | "PAPER_ORDER_BLOCKED";

export type ExecutionTicketPaperOrderDecision = {
  id: string;
  sourceTicketId: string;
  symbol: string;
  direction: "BUY" | "SELL" | "NONE";
  status: ExecutionTicketPaperOrderStatus;
  orderId: string | null;
  positionId: string | null;
  brokerTarget: string;
  preferredBroker: string;
  secondaryBroker: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  requestedSize: number;
  createdOrderStatus: string | null;
  openedPositionStatus: string | null;
  accountBalance: number | null;
  accountEquity: number | null;
  accountOpenPositions: number | null;
  liveExecutionEnabled: false;
  reason: string;
};

export type ExecutionTicketPaperOrderSyncReport = {
  version: "V16.2.0";
  status: "READY";
  mode: "SIMULATION";
  totalTickets: number;
  createdOrders: number;
  waitingOrders: number;
  blockedOrders: number;
  liveExecutionEnabled: false;
  decisions: ExecutionTicketPaperOrderDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
