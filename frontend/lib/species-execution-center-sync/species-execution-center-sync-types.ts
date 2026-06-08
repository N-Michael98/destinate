export type SpeciesExecutionCenterSyncStatus = "READY";

export type ExecutionCenterSyncSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type ExecutionCenterTicketStatus =
  | "SYNCED_READY"
  | "SYNCED_LIMITED"
  | "SYNC_BLOCKED";

export type ExecutionCenterDestination =
  | "EXECUTION_QUEUE_ENGINE"
  | "LIMITED_EXECUTION_QUEUE_ENGINE"
  | "NO_EXECUTION_ROUTE";

export type SpeciesExecutionCenterSyncTicket = {
  sourceTicketId: string;
  executionCenterTicketId: string;
  species: ExecutionCenterSyncSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  queuePriority: "PRIMARY" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  ticketStatus: ExecutionCenterTicketStatus;
  destination: ExecutionCenterDestination;
  tradeApprovalRequired: boolean;
  brokerRoutingRequired: boolean;
  syncRole: string;
};

export type SpeciesExecutionCenterSyncReport = {
  version: "V14.8.0";
  status: SpeciesExecutionCenterSyncStatus;
  mode: "SIMULATION";
  source: "SPECIES_EXECUTION_QUEUE";
  target: "EXECUTION_CENTER";
  symbol: "XAUUSD";
  totalSourceTickets: number;
  totalSyncedTickets: number;
  readySyncedTickets: number;
  limitedSyncedTickets: number;
  blockedSyncedTickets: number;
  totalSyncedCapitalUsd: number;
  totalSyncedPositionSizeUsd: number;
  totalSyncedLotSize: number;
  primarySpecies: ExecutionCenterSyncSpecies;
  syncTickets: SpeciesExecutionCenterSyncTicket[];
  blockedSpecies: ExecutionCenterSyncSpecies[];
  summary: string;
};
