export type SpeciesBrokerRoutingSyncStatus = "READY";

export type BrokerRoutingSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type SupportedBroker = "CAPITAL_COM" | "IC_MARKETS" | "DUAL_BROKER" | "NO_BROKER";

export type BrokerRoutingStatus =
  | "ROUTING_READY"
  | "ROUTING_LIMITED"
  | "ROUTING_BLOCKED";

export type BrokerRoutingPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED";

export type SpeciesBrokerRoutingSyncTicket = {
  sourceTradeApprovalTicketId: string;
  brokerRoutingTicketId: string;
  species: BrokerRoutingSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  preferredBroker: SupportedBroker;
  backupBroker: SupportedBroker;
  routingPriority: BrokerRoutingPriority;
  routingStatus: BrokerRoutingStatus;
  executionDestination: "BROKER_ROUTING_LAYER" | "LIMITED_BROKER_ROUTING_LAYER" | "NO_ROUTE";
  brokerConfidence: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  executionRank: number;
  approvalStatus: "APPROVAL_READY" | "APPROVAL_LIMITED" | "APPROVAL_BLOCKED";
  routingRole: string;
};

export type SpeciesBrokerRoutingSyncReport = {
  version: "V15.0.0";
  status: SpeciesBrokerRoutingSyncStatus;
  mode: "SIMULATION";
  source: "SPECIES_TRADE_APPROVAL_SYNC";
  target: "BROKER_ROUTING_LAYER";
  symbol: "XAUUSD";
  totalSourceTickets: number;
  totalRoutingTickets: number;
  routingReadyTickets: number;
  routingLimitedTickets: number;
  routingBlockedTickets: number;
  capitalComTickets: number;
  icMarketsTickets: number;
  dualBrokerTickets: number;
  totalRoutingCapitalUsd: number;
  totalRoutingPositionSizeUsd: number;
  totalRoutingLotSize: number;
  primaryBrokerSpecies: BrokerRoutingSpecies;
  routingTickets: SpeciesBrokerRoutingSyncTicket[];
  blockedSpecies: BrokerRoutingSpecies[];
  summary: string;
};
