export type SpeciesLiveExecutionBridgeStatus = "READY";

export type LiveBridgeSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type LiveBridgeBroker =
  | "CAPITAL_COM"
  | "IC_MARKETS"
  | "DUAL_BROKER"
  | "NO_BROKER";

export type BridgeStatus =
  | "LIVE_EXECUTION_READY"
  | "LIVE_EXECUTION_LIMITED"
  | "LIVE_EXECUTION_BLOCKED";

export type BrokerHandshakeStatus =
  | "HANDSHAKE_READY"
  | "HANDSHAKE_LIMITED"
  | "HANDSHAKE_BLOCKED";

export type ExecutionBridgeHealth =
  | "HEALTHY"
  | "DEGRADED"
  | "BLOCKED";

export type BridgePriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED";

export type SpeciesLiveExecutionBridgeTicket = {
  sourceQueueTicketId: string;
  bridgeTicketId: string;
  species: LiveBridgeSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  bridgeStatus: BridgeStatus;
  liveExecutionReady: boolean;
  executionRoute: "EXECUTION_QUEUE_ENGINE" | "LIMITED_EXECUTION_QUEUE_ENGINE" | "NO_EXECUTION_ROUTE";
  executionMode: "LIVE_BRIDGE_SIMULATION";
  brokerHandshakeStatus: BrokerHandshakeStatus;
  executionBridgeHealth: ExecutionBridgeHealth;
  bridgePriority: BridgePriority;
  scheduledBroker: LiveBridgeBroker;
  backupBroker: LiveBridgeBroker;
  queuePosition: number;
  executionWindow: "IMMEDIATE" | "STANDARD" | "TACTICAL" | "BLOCKED";
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  bridgeRole: string;
};

export type SpeciesLiveExecutionBridgeReport = {
  version: "V15.3.0";
  status: SpeciesLiveExecutionBridgeStatus;
  mode: "SIMULATION";
  source: "SPECIES_EXECUTION_QUEUE_INTEGRATION";
  target: "LIVE_EXECUTION_BRIDGE";
  symbol: "XAUUSD";
  totalSourceQueueTickets: number;
  totalBridgeTickets: number;
  liveReadyTickets: number;
  liveLimitedTickets: number;
  liveBlockedTickets: number;
  healthyBridgeTickets: number;
  degradedBridgeTickets: number;
  blockedBridgeTickets: number;
  handshakeReadyTickets: number;
  handshakeLimitedTickets: number;
  handshakeBlockedTickets: number;
  totalBridgeCapitalUsd: number;
  totalBridgePositionSizeUsd: number;
  totalBridgeLotSize: number;
  averageBridgeFillQuality: number;
  averageBridgeLatencyMs: number;
  primaryBridgeSpecies: LiveBridgeSpecies;
  bridgeTickets: SpeciesLiveExecutionBridgeTicket[];
  blockedSpecies: LiveBridgeSpecies[];
  summary: string;
};
