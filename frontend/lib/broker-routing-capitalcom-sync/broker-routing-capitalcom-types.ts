export type CapitalComRouteStatus =
  | "SYNCED"
  | "WAITING_FOR_APPROVAL"
  | "BLOCKED";

export type BrokerRoutingCapitalComInput = {
  id: string;
  symbol: string;
  tradingStyle: "SCALPING" | "DAYTRADING" | "SWING" | "NONE";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  brokerRouteStatus: "ROUTED" | "WAITING" | "BLOCKED";
  preferredBroker: "IC_MARKETS" | "CAPITAL_COM" | "PAPER_BROKER" | "NO_BROKER";
  fallbackBroker: "IC_MARKETS" | "CAPITAL_COM" | "PAPER_BROKER" | "NO_BROKER";
  executionMode: "SIMULATION" | "PAPER" | "LIVE_READY" | "LIVE_BLOCKED";
  executionPriority: number;
  queuePosition: number;
  finalPositionSize: number;
  positionSizeMultiplier: number;
};

export type CapitalComConnectorSnapshot = {
  connectorMode: "READ_ONLY";
  accountMode: "DEMO";
  connectionStatus: "PREPARED";
  apiHealth: "HEALTHY";
  liveTradingEnabled: false;
  allowLiveOrders: false;
  maxLeverage: 200;
  leverageRiskMode: "CONTROLLED";
};

export type BrokerRoutingCapitalComSyncItem = {
  id: string;
  sourceRouteId: string;
  symbol: string;
  tradingStyle: string;
  direction: string;
  capitalComRouteStatus: CapitalComRouteStatus;
  capitalComEligible: boolean;
  readOnlySafe: boolean;
  liveExecutionBlocked: boolean;
  originalPositionSize: number;
  capitalComAdjustedPositionSize: number;
  leverage: number;
  leverageRiskMultiplier: number;
  executionPriority: number;
  queuePosition: number;
  reason: string;
  createdAt: string;
};

export type BrokerRoutingCapitalComSyncReport = {
  version: "V12.0.5";
  status: "READY";
  mode: "SIMULATION";
  connector: CapitalComConnectorSnapshot;
  totalRoutes: number;
  syncedRoutes: number;
  waitingRoutes: number;
  blockedRoutes: number;
  liveExecutionEnabled: false;
  readOnlyMode: true;
  items: BrokerRoutingCapitalComSyncItem[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
