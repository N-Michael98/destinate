export type SpeciesExecutionQueueIntegrationStatus = "READY";

export type QueueIntegrationSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type QueueIntegrationBroker =
  | "CAPITAL_COM"
  | "IC_MARKETS"
  | "DUAL_BROKER"
  | "NO_BROKER";

export type QueueTicketStatus =
  | "QUEUE_READY"
  | "QUEUE_LIMITED"
  | "QUEUE_BLOCKED";

export type QueuePriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED";

export type ExecutionWindow =
  | "IMMEDIATE"
  | "STANDARD"
  | "TACTICAL"
  | "BLOCKED";

export type SpeciesExecutionQueueIntegrationTicket = {
  sourceExecutionTicketId: string;
  queueTicketId: string;
  species: QueueIntegrationSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  queueStatus: QueueTicketStatus;
  queuePriority: QueuePriority;
  queuePosition: number;
  executionWindow: ExecutionWindow;
  scheduledBroker: QueueIntegrationBroker;
  backupBroker: QueueIntegrationBroker;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  queueReady: boolean;
  queueTarget: "EXECUTION_QUEUE_ENGINE" | "LIMITED_EXECUTION_QUEUE_ENGINE" | "NO_EXECUTION_QUEUE";
  queueRole: string;
};

export type SpeciesExecutionQueueIntegrationReport = {
  version: "V15.2.0";
  status: SpeciesExecutionQueueIntegrationStatus;
  mode: "SIMULATION";
  source: "SPECIES_EXECUTION_TICKET_GENERATOR";
  target: "EXECUTION_QUEUE_ENGINE";
  symbol: "XAUUSD";
  totalSourceExecutionTickets: number;
  totalQueueTickets: number;
  queueReadyTickets: number;
  queueLimitedTickets: number;
  queueBlockedTickets: number;
  immediateWindowTickets: number;
  standardWindowTickets: number;
  tacticalWindowTickets: number;
  capitalComQueueTickets: number;
  icMarketsQueueTickets: number;
  dualBrokerQueueTickets: number;
  totalQueueCapitalUsd: number;
  totalQueuePositionSizeUsd: number;
  totalQueueLotSize: number;
  averageQueueFillQuality: number;
  averageQueueLatencyMs: number;
  primaryQueueSpecies: QueueIntegrationSpecies;
  queueTickets: SpeciesExecutionQueueIntegrationTicket[];
  blockedSpecies: QueueIntegrationSpecies[];
  summary: string;
};
