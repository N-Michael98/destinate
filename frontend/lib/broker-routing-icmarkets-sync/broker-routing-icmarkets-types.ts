export type ICMarketsSyncStatus =
  | "READY"
  | "WAITING"
  | "BLOCKED";

export type ICMarketsRouteStatus =
  | "SYNCED"
  | "WAITING_FOR_APPROVAL"
  | "BLOCKED";

export type BrokerRoutingICMarketsInput = {
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

export type ICMarketsConnectorSnapshot = {
  connectorMode: "READ_ONLY";
  accountMode: "DEMO";
  connectionStatus: "PREPARED";
  apiHealth: "HEALTHY";
  liveTradingEnabled: false;
  allowLiveOrders: false;
  maxLeverage: 500;
  leverageRiskMode: "STRICT";
};

export type BrokerRoutingICMarketsSyncItem = {
  id: string;
  sourceRouteId: string;
  symbol: string;
  tradingStyle: string;
  direction: string;
  icMarketsRouteStatus: ICMarketsRouteStatus;
  icMarketsEligible: boolean;
  readOnlySafe: boolean;
  liveExecutionBlocked: boolean;
  originalPositionSize: number;
  icMarketsAdjustedPositionSize: number;
  leverage: number;
  leverageRiskMultiplier: number;
  executionPriority: number;
  queuePosition: number;
  reason: string;
  createdAt: string;
};

export type BrokerRoutingICMarketsSyncReport = {
  version: "V12.0.4";
  status: "READY";
  mode: "SIMULATION";
  connector: ICMarketsConnectorSnapshot;
  totalRoutes: number;
  syncedRoutes: number;
  waitingRoutes: number;
  blockedRoutes: number;
  liveExecutionEnabled: false;
  readOnlyMode: true;
  items: BrokerRoutingICMarketsSyncItem[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
