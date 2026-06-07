export type BrokerName =
  | "IC_MARKETS"
  | "CAPITAL_COM"
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

export type BrokerDecisionStatus =
  | "APPROVED"
  | "WAITING"
  | "BLOCKED";

export type DualBrokerMode =
  | "DUAL_BROKER_READY"
  | "SINGLE_BROKER_READY"
  | "WAITING"
  | "BLOCKED";

export type BrokerSyncInput = {
  broker: BrokerName;
  symbol: string;
  tradingStyle: TradingStyle;
  direction: Direction;
  routeStatus: "SYNCED" | "WAITING_FOR_APPROVAL" | "BLOCKED";
  eligible: boolean;
  leverage: number;
  leverageRiskMultiplier: number;
  adjustedPositionSize: number;
  originalPositionSize: number;
  executionPriority: number;
  queuePosition: number;
  readOnlySafe: boolean;
  liveExecutionBlocked: boolean;
};

export type BrokerAllocationDecision = {
  broker: BrokerName;
  brokerDecisionStatus: BrokerDecisionStatus;
  eligible: boolean;
  leverage: number;
  leverageRiskMultiplier: number;
  allocationPercent: number;
  allocatedPositionSize: number;
  executionPriority: number;
  reason: string;
};

export type DualBrokerSymbolDecision = {
  id: string;
  symbol: string;
  tradingStyle: TradingStyle;
  direction: Direction;
  dualBrokerMode: DualBrokerMode;
  finalDecisionStatus: BrokerDecisionStatus;
  totalAllocatedPositionSize: number;
  preferredBroker: BrokerName;
  secondaryBroker: BrokerName;
  useDualBrokerExecution: boolean;
  readOnlySafe: boolean;
  liveExecutionBlocked: boolean;
  allocations: BrokerAllocationDecision[];
  reason: string;
  createdAt: string;
};

export type DualBrokerOrchestratorReport = {
  version: "V12.0.6";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  dualBrokerReadySymbols: number;
  singleBrokerReadySymbols: number;
  waitingSymbols: number;
  blockedSymbols: number;
  liveExecutionEnabled: false;
  readOnlyMode: true;
  decisions: DualBrokerSymbolDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
