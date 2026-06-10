export type DualBrokerSyncMode =
  | "DUAL_BROKER_READY"
  | "SINGLE_BROKER_READY"
  | "WAITING"
  | "BLOCKED";

export type BrokerAllocation = {
  broker: "IC_MARKETS" | "CAPITAL_COM" | "NO_BROKER";
  eligible: boolean;
  allocationPercent: number;
  allocatedPositionSize: number;
  routeStatus: "SYNCED" | "WAITING_FOR_APPROVAL" | "BLOCKED";
  leverage: number;
  leverageRiskMultiplier: number;
  reason: string;
};

export type BrokerRoutingDualBrokerDecision = {
  id: string;
  symbol: string;
  tradingStyle: string;
  direction: string;
  dualBrokerMode: DualBrokerSyncMode;
  preferredBroker: string;
  secondaryBroker: string;
  useDualBrokerExecution: boolean;
  finalDecisionStatus: "APPROVED" | "WAITING" | "BLOCKED";
  totalAllocatedPositionSize: number;
  originalPositionSize: number;
  executionPriority: number;
  readOnlySafe: true;
  liveExecutionBlocked: true;
  allocations: BrokerAllocation[];
  reason: string;
};

export type BrokerRoutingDualBrokerSyncReport = {
  version: "V16.1.7";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  dualBrokerReadySymbols: number;
  singleBrokerReadySymbols: number;
  waitingSymbols: number;
  blockedSymbols: number;
  liveExecutionEnabled: false;
  readOnlyMode: true;
  decisions: BrokerRoutingDualBrokerDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
