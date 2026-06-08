export type SpeciesExecutionTicketGeneratorStatus = "READY";

export type ExecutionTicketSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type ExecutionBroker =
  | "CAPITAL_COM"
  | "IC_MARKETS"
  | "DUAL_BROKER"
  | "NO_BROKER";

export type ExecutionTicketStatus =
  | "EXECUTION_READY"
  | "EXECUTION_LIMITED"
  | "EXECUTION_BLOCKED";

export type ExecutionPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED";

export type SpeciesExecutionTicket = {
  sourceBrokerRoutingTicketId: string;
  executionTicketId: string;
  species: ExecutionTicketSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  executionBroker: ExecutionBroker;
  backupBroker: ExecutionBroker;
  executionStatus: ExecutionTicketStatus;
  executionPriority: ExecutionPriority;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  brokerConfidence: number;
  readyForExecution: boolean;
  executionQueueTarget: "EXECUTION_QUEUE_ENGINE" | "LIMITED_EXECUTION_QUEUE_ENGINE" | "NO_EXECUTION_QUEUE";
  executionRole: string;
};

export type SpeciesExecutionTicketGeneratorReport = {
  version: "V15.1.0";
  status: SpeciesExecutionTicketGeneratorStatus;
  mode: "SIMULATION";
  source: "SPECIES_BROKER_ROUTING_SYNC";
  target: "EXECUTION_TICKET_GENERATOR";
  symbol: "XAUUSD";
  totalSourceRoutingTickets: number;
  totalExecutionTickets: number;
  executionReadyTickets: number;
  executionLimitedTickets: number;
  executionBlockedTickets: number;
  capitalComExecutionTickets: number;
  icMarketsExecutionTickets: number;
  dualBrokerExecutionTickets: number;
  totalExecutionCapitalUsd: number;
  totalExecutionPositionSizeUsd: number;
  totalExecutionLotSize: number;
  averageFillQuality: number;
  averageLatencyMs: number;
  primaryExecutionSpecies: ExecutionTicketSpecies;
  executionTickets: SpeciesExecutionTicket[];
  blockedSpecies: ExecutionTicketSpecies[];
  summary: string;
};
