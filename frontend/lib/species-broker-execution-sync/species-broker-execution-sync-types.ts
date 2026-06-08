export type SpeciesBrokerExecutionSyncStatus = "READY";

export type BrokerExecutionSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type BrokerExecutionTarget =
  | "CAPITAL_COM"
  | "IC_MARKETS"
  | "DUAL_BROKER"
  | "NO_BROKER";

export type ExecutionSyncStatus =
  | "DISPATCH_READY"
  | "DISPATCH_LIMITED"
  | "DISPATCH_BLOCKED";

export type BrokerConnectionStatus =
  | "CONNECTED"
  | "LIMITED_CONNECTION"
  | "NO_CONNECTION";

export type ExecutionConfirmationStatus =
  | "CONFIRMATION_PENDING"
  | "LIMITED_CONFIRMATION"
  | "CONFIRMATION_BLOCKED";

export type ExecutionSyncHealth =
  | "HEALTHY"
  | "DEGRADED"
  | "BLOCKED";

export type BrokerExecutionPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED";

export type SpeciesBrokerExecutionSyncTicket = {
  sourceBridgeTicketId: string;
  brokerExecutionTicketId: string;
  species: BrokerExecutionSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  executionSyncStatus: ExecutionSyncStatus;
  targetBroker: BrokerExecutionTarget;
  backupBroker: BrokerExecutionTarget;
  brokerConnectionStatus: BrokerConnectionStatus;
  executionConfirmationStatus: ExecutionConfirmationStatus;
  executionSyncHealth: ExecutionSyncHealth;
  executionDispatchReady: boolean;
  brokerExecutionPriority: BrokerExecutionPriority;
  queuePosition: number;
  executionWindow: "IMMEDIATE" | "STANDARD" | "TACTICAL" | "BLOCKED";
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  brokerExecutionRole: string;
};

export type SpeciesBrokerExecutionSyncReport = {
  version: "V15.4.0";
  status: SpeciesBrokerExecutionSyncStatus;
  mode: "SIMULATION";
  source: "SPECIES_LIVE_EXECUTION_BRIDGE";
  target: "BROKER_EXECUTION_SYNC";
  symbol: "XAUUSD";
  totalSourceBridgeTickets: number;
  totalBrokerExecutionTickets: number;
  dispatchReadyTickets: number;
  dispatchLimitedTickets: number;
  dispatchBlockedTickets: number;
  connectedBrokerTickets: number;
  limitedConnectionTickets: number;
  noConnectionTickets: number;
  confirmationPendingTickets: number;
  limitedConfirmationTickets: number;
  confirmationBlockedTickets: number;
  healthySyncTickets: number;
  degradedSyncTickets: number;
  blockedSyncTickets: number;
  capitalComExecutionTickets: number;
  icMarketsExecutionTickets: number;
  dualBrokerExecutionTickets: number;
  totalBrokerExecutionCapitalUsd: number;
  totalBrokerExecutionPositionSizeUsd: number;
  totalBrokerExecutionLotSize: number;
  averageBrokerExecutionFillQuality: number;
  averageBrokerExecutionLatencyMs: number;
  primaryBrokerExecutionSpecies: BrokerExecutionSpecies;
  brokerExecutionTickets: SpeciesBrokerExecutionSyncTicket[];
  blockedSpecies: BrokerExecutionSpecies[];
  summary: string;
};
