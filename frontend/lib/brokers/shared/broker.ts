export type BrokerName = "capital-com" | "ic-markets";

export type BrokerConnectionStatus =
  | "DISCONNECTED"
  | "PREPARED"
  | "CONNECTED"
  | "ERROR";

export type BrokerTradingPermission =
  | "LOCKED"
  | "PAPER_ONLY"
  | "DEMO_ONLY"
  | "LIVE_READY";

export type BrokerAccountSnapshot = {
  broker: BrokerName;
  accountId: string | null;
  currency: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  mode: "SIMULATION" | "DEMO" | "LIVE";
};

export type BrokerPositionSnapshot = {
  id: string;
  broker: BrokerName;
  market: string;
  direction: "BUY" | "SELL";
  size: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  profitLoss: number;
  status: "OPEN" | "CLOSED";
};

export type BrokerOrderRequest = {
  market: string;
  direction: "BUY" | "SELL";
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
};

export type BrokerOrderResponse = {
  success: boolean;
  broker: BrokerName;
  orderId: string | null;
  message: string;
};

export type BrokerConnector = {
  name: BrokerName;
  displayName: string;
  status: BrokerConnectionStatus;
  tradingPermission: BrokerTradingPermission;
  connect: () => Promise<BrokerOrderResponse>;
  getAccount: () => Promise<BrokerAccountSnapshot>;
  getPositions: () => Promise<BrokerPositionSnapshot[]>;
  placeOrder: (order: BrokerOrderRequest) => Promise<BrokerOrderResponse>;
};