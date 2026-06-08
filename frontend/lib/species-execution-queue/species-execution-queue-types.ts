export type SpeciesExecutionQueueStatus = "READY";

export type ExecutionQueueSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type QueuePriority = "PRIMARY" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";

export type ExecutionTicketStatus =
  | "READY_FOR_EXECUTION"
  | "LIMITED_READY"
  | "BLOCKED";

export type SpeciesExecutionQueueTicket = {
  ticketId: string;
  species: ExecutionQueueSpecies;
  slotNumber: number;
  baseSymbol: "XAUUSD";
  queuePriority: QueuePriority;
  executionPermission: "ENABLED" | "LIMITED" | "DISABLED";
  ticketStatus: ExecutionTicketStatus;
  capitalPerTradeUsd: number;
  positionSizePerTradeUsd: number;
  lotSizePerTrade: number;
  executionRank: number;
  routingHint: "EXECUTION_CENTER" | "LIMITED_EXECUTION_CENTER" | "NO_ROUTE";
  ticketRole: string;
};

export type SpeciesExecutionQueueReport = {
  version: "V14.7.0";
  status: SpeciesExecutionQueueStatus;
  mode: "SIMULATION";
  baseSymbol: "XAUUSD";
  totalQueueTickets: number;
  readyTickets: number;
  limitedTickets: number;
  blockedTickets: number;
  primarySpecies: ExecutionQueueSpecies;
  queueTickets: SpeciesExecutionQueueTicket[];
  blockedSpecies: ExecutionQueueSpecies[];
  summary: string;
};
