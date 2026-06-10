export type BrokerSelectionRoutingStatus =
  | "ROUTED"
  | "WAITING"
  | "BLOCKED";

export type BrokerSelectionRoutingDecision = {
  id: string;
  symbol: string;
  tradingStyle: "SCALPING" | "DAYTRADING" | "SWING" | "NONE";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  brokerRoutingMode: string;
  preferredBroker: string;
  fallbackBroker: string;
  brokerRouteStatus: BrokerSelectionRoutingStatus;
  executionMode: "SIMULATION" | "PAPER" | "LIVE_BLOCKED";
  executionPriority: number;
  queuePosition: number;
  finalPositionSize: number;
  positionSizeMultiplier: number;
  capitalComAllocation: number;
  icMarketsAllocation: number;
  allowExecution: boolean;
  requireStrictApproval: boolean;
  portfolioBrainRoute: string;
  reason: string;
};

export type BrokerSelectionRoutingSyncReport = {
  version: "V16.1.6";
  status: "READY";
  mode: "SIMULATION";
  totalRoutes: number;
  routedRoutes: number;
  waitingRoutes: number;
  blockedRoutes: number;
  icMarketsRoutes: number;
  capitalComRoutes: number;
  dualBrokerRoutes: number;
  liveExecutionEnabled: false;
  decisions: BrokerSelectionRoutingDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
