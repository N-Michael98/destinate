import { BrokerId, TradingStyle } from "../smart-broker-selection";

export type SmartBrokerExecutionSyncStatus =
  | "READY"
  | "ROUTED"
  | "MIXED_ROUTE"
  | "BLOCKED";

export type SmartBrokerExecutionSyncMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export interface MockExecutionQueueItem {
  id: string;
  symbol: string;
  tradeDirection: "LONG" | "SHORT";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  requestedAllocationPercent: number;
  approvalStatus: "APPROVED" | "BLOCKED";
}

export interface BrokerExecutionRoute {
  brokerId: BrokerId;
  brokerName: string;
  allocationPercent: number;
  brokerScore: number;
  routeStatus: "ACTIVE" | "STANDBY" | "BLOCKED";
}

export interface SmartBrokerExecutionRouteResult {
  queueItemId: string;
  symbol: string;
  tradeDirection: "LONG" | "SHORT";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: SmartBrokerExecutionSyncStatus;
  selectedBroker: BrokerId | "MIXED" | "NONE";
  routes: BrokerExecutionRoute[];
  routingReason: string;
}

export interface SmartBrokerExecutionSyncReport {
  version: "V12.1.2";
  status: SmartBrokerExecutionSyncStatus;
  mode: SmartBrokerExecutionSyncMode[];
  totalQueueItems: number;
  routedItems: number;
  mixedRouteItems: number;
  blockedItems: number;
  routeResults: SmartBrokerExecutionRouteResult[];
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
  };
  createdAt: string;
}
