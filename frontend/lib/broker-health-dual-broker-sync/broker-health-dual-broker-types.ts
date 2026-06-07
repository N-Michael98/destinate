export type BrokerName = "IC_MARKETS" | "CAPITAL_COM" | "NO_BROKER";

export type BrokerHealthStatus = "HEALTHY" | "WARNING" | "CRITICAL";

export type DualBrokerMode =
  | "HEALTH_WEIGHTED_DUAL_READY"
  | "HEALTH_WEIGHTED_SINGLE_READY"
  | "WAITING"
  | "BLOCKED";

export type BrokerHealthInput = {
  broker: BrokerName;
  apiHealth: BrokerHealthStatus;
  brokerScore: number;
  riskScore: number;
  leverage: number;
  averageLatencyMs: number;
  currentSpreadPoints: number;
  canRouteOrders: boolean;
  shouldReduceSize: boolean;
  shouldBlockNewOrders: boolean;
};

export type DualBrokerInput = {
  symbol: string;
  tradingStyle: "SCALPING" | "DAYTRADING" | "SWING" | "NONE";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  broker: BrokerName;
  brokerDecisionStatus: "APPROVED" | "WAITING" | "BLOCKED";
  eligible: boolean;
  leverageRiskMultiplier: number;
  allocationPercent: number;
  allocatedPositionSize: number;
  executionPriority: number;
};

export type HealthWeightedBrokerAllocation = {
  broker: BrokerName;
  brokerDecisionStatus: "APPROVED" | "WAITING" | "BLOCKED";
  healthStatus: BrokerHealthStatus | "UNKNOWN";
  brokerScore: number;
  riskScore: number;
  originalAllocationPercent: number;
  healthWeightedAllocationPercent: number;
  originalPositionSize: number;
  healthWeightedPositionSize: number;
  shouldReduceSize: boolean;
  shouldBlockNewOrders: boolean;
  reason: string;
};

export type BrokerHealthDualBrokerDecision = {
  id: string;
  symbol: string;
  tradingStyle: string;
  direction: string;
  dualBrokerMode: DualBrokerMode;
  finalDecisionStatus: "APPROVED" | "WAITING" | "BLOCKED";
  preferredBroker: BrokerName;
  secondaryBroker: BrokerName;
  totalOriginalPositionSize: number;
  totalHealthWeightedPositionSize: number;
  useDualBrokerExecution: boolean;
  allocations: HealthWeightedBrokerAllocation[];
  reason: string;
  createdAt: string;
};

export type BrokerHealthDualBrokerSyncReport = {
  version: "V12.0.8";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  healthWeightedDualReadySymbols: number;
  healthWeightedSingleReadySymbols: number;
  waitingSymbols: number;
  blockedSymbols: number;
  liveExecutionEnabled: false;
  readOnlyMode: true;
  decisions: BrokerHealthDualBrokerDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
