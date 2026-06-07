export type BrokerName =
  | "IC_MARKETS"
  | "CAPITAL_COM"
  | "PAPER_BROKER"
  | "NO_BROKER";

export type TradingStyle =
  | "SCALPING"
  | "DAYTRADING"
  | "SWING"
  | "NONE";

export type Direction =
  | "LONG"
  | "SHORT"
  | "NEUTRAL";

export type BrokerRouteStatus =
  | "ROUTED"
  | "WAITING"
  | "BLOCKED";

export type BrokerExecutionMode =
  | "SIMULATION"
  | "PAPER"
  | "LIVE_READY"
  | "LIVE_BLOCKED";

export type BrokerRoutingInput = {
  id: string;
  symbol: string;
  tradingStyle: TradingStyle;
  direction: Direction;
  schedulerStatus: "SCHEDULED" | "WAITING" | "BLOCKED";
  executionUrgency: "IMMEDIATE" | "HIGH" | "NORMAL" | "LOW" | "NONE";
  executionPriority: number;
  queuePosition: number;
  allowExecution: boolean;
  requireStrictApproval: boolean;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  portfolioBrainRoute: string;
};

export type BrokerRoute = {
  id: string;
  sourceSchedulerId: string;
  symbol: string;
  tradingStyle: TradingStyle;
  direction: Direction;
  preferredBroker: BrokerName;
  fallbackBroker: BrokerName;
  brokerRouteStatus: BrokerRouteStatus;
  executionMode: BrokerExecutionMode;
  executionPriority: number;
  queuePosition: number;
  finalPositionSize: number;
  positionSizeMultiplier: number;
  routeReason: string;
  safetyRule: string;
  createdAt: string;
};

export type BrokerRoutingLayerReport = {
  version: "V12.0.2";
  status: "READY";
  mode: "SIMULATION";
  totalSchedulerItems: number;
  routedItems: number;
  waitingItems: number;
  blockedItems: number;
  paperBrokerRoutes: number;
  icMarketsRoutes: number;
  capitalComRoutes: number;
  liveExecutionEnabled: false;
  routes: BrokerRoute[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
