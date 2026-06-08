import {
  ExecutionWindow,
  QueueIntegrationBroker,
  QueueIntegrationSpecies,
  QueuePriority,
  SpeciesExecutionQueueIntegrationReport,
  SpeciesExecutionQueueIntegrationTicket,
} from "./species-execution-queue-integration-types";

type SourceExecutionTicket = {
  executionTicketId: string;
  species: QueueIntegrationSpecies;
  executionBroker: QueueIntegrationBroker;
  backupBroker: QueueIntegrationBroker;
  executionStatus: "EXECUTION_READY" | "EXECUTION_LIMITED" | "EXECUTION_BLOCKED";
  executionPriority: QueuePriority;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  readyForExecution: boolean;
  executionQueueTarget:
    | "EXECUTION_QUEUE_ENGINE"
    | "LIMITED_EXECUTION_QUEUE_ENGINE"
    | "NO_EXECUTION_QUEUE";
};

const sourceExecutionTickets: SourceExecutionTicket[] = [
  {
    executionTicketId: "EXEC-TICKET-SPECIES-001",
    species: "HYBRID",
    executionBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_READY",
    executionPriority: "CRITICAL",
    executionRank: 1,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-002",
    species: "HYBRID",
    executionBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_READY",
    executionPriority: "CRITICAL",
    executionRank: 2,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-003",
    species: "HYBRID",
    executionBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_READY",
    executionPriority: "CRITICAL",
    executionRank: 3,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-004",
    species: "HYBRID",
    executionBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_READY",
    executionPriority: "CRITICAL",
    executionRank: 4,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-005",
    species: "LIQUIDITY",
    executionBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    executionStatus: "EXECUTION_READY",
    executionPriority: "HIGH",
    executionRank: 5,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    estimatedFillQuality: 90,
    estimatedLatencyMs: 92,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-006",
    species: "LIQUIDITY",
    executionBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    executionStatus: "EXECUTION_READY",
    executionPriority: "HIGH",
    executionRank: 6,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    estimatedFillQuality: 90,
    estimatedLatencyMs: 92,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-009",
    species: "INSTITUTIONAL",
    executionBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    executionStatus: "EXECUTION_READY",
    executionPriority: "HIGH",
    executionRank: 7,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    estimatedFillQuality: 95,
    estimatedLatencyMs: 84,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-010",
    species: "INSTITUTIONAL",
    executionBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    executionStatus: "EXECUTION_READY",
    executionPriority: "HIGH",
    executionRank: 8,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    estimatedFillQuality: 95,
    estimatedLatencyMs: 84,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-007",
    species: "TREND",
    executionBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_READY",
    executionPriority: "MEDIUM",
    executionRank: 9,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    estimatedFillQuality: 88,
    estimatedLatencyMs: 71,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-008",
    species: "TREND",
    executionBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_READY",
    executionPriority: "MEDIUM",
    executionRank: 10,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    estimatedFillQuality: 88,
    estimatedLatencyMs: 71,
    readyForExecution: true,
    executionQueueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    executionTicketId: "EXEC-TICKET-SPECIES-011",
    species: "BREAKOUT",
    executionBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    executionStatus: "EXECUTION_LIMITED",
    executionPriority: "LOW",
    executionRank: 11,
    capitalUsd: 4000,
    positionSizeUsd: 555.56,
    lotSize: 0.006,
    estimatedFillQuality: 76,
    estimatedLatencyMs: 71,
    readyForExecution: false,
    executionQueueTarget: "LIMITED_EXECUTION_QUEUE_ENGINE",
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getQueueStatus(
  status: SourceExecutionTicket["executionStatus"]
): SpeciesExecutionQueueIntegrationTicket["queueStatus"] {
  if (status === "EXECUTION_READY") return "QUEUE_READY";
  if (status === "EXECUTION_LIMITED") return "QUEUE_LIMITED";
  return "QUEUE_BLOCKED";
}

function getExecutionWindow(
  priority: QueuePriority,
  status: SourceExecutionTicket["executionStatus"]
): ExecutionWindow {
  if (status === "EXECUTION_BLOCKED") return "BLOCKED";
  if (priority === "CRITICAL") return "IMMEDIATE";
  if (priority === "LOW") return "TACTICAL";
  return "STANDARD";
}

function getQueueRole(species: QueueIntegrationSpecies): string {
  const roles: Record<QueueIntegrationSpecies, string> = {
    HYBRID: "Critical Hybrid ticket integrated into the primary Execution Queue.",
    LIQUIDITY: "Liquidity-aware ticket integrated into defensive execution queue flow.",
    TREND: "Trend-following ticket integrated into directional execution queue flow.",
    INSTITUTIONAL: "Institutional ticket integrated into validated execution queue flow.",
    BREAKOUT: "Limited breakout ticket integrated into tactical execution queue flow.",
    MEAN_REVERSION: "Queue integration blocked until species becomes active.",
  };

  return roles[species];
}

export function getSpeciesExecutionQueueIntegrationReport(): SpeciesExecutionQueueIntegrationReport {
  const queueTickets: SpeciesExecutionQueueIntegrationTicket[] =
    sourceExecutionTickets.map((ticket) => ({
      sourceExecutionTicketId: ticket.executionTicketId,
      queueTicketId: ticket.executionTicketId.replace(
        "EXEC-TICKET",
        "QUEUE-TICKET"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      queueStatus: getQueueStatus(ticket.executionStatus),
      queuePriority: ticket.executionPriority,
      queuePosition: ticket.executionRank,
      executionWindow: getExecutionWindow(
        ticket.executionPriority,
        ticket.executionStatus
      ),
      scheduledBroker: ticket.executionBroker,
      backupBroker: ticket.backupBroker,
      capitalUsd: ticket.capitalUsd,
      positionSizeUsd: ticket.positionSizeUsd,
      lotSize: ticket.lotSize,
      estimatedFillQuality: ticket.estimatedFillQuality,
      estimatedLatencyMs: ticket.estimatedLatencyMs,
      queueReady: ticket.readyForExecution,
      queueTarget: ticket.executionQueueTarget,
      queueRole: getQueueRole(ticket.species),
    }));

  const queueReadyTickets = queueTickets.filter(
    (ticket) => ticket.queueStatus === "QUEUE_READY"
  ).length;

  const queueLimitedTickets = queueTickets.filter(
    (ticket) => ticket.queueStatus === "QUEUE_LIMITED"
  ).length;

  const queueBlockedTickets = queueTickets.filter(
    (ticket) => ticket.queueStatus === "QUEUE_BLOCKED"
  ).length;

  const immediateWindowTickets = queueTickets.filter(
    (ticket) => ticket.executionWindow === "IMMEDIATE"
  ).length;

  const standardWindowTickets = queueTickets.filter(
    (ticket) => ticket.executionWindow === "STANDARD"
  ).length;

  const tacticalWindowTickets = queueTickets.filter(
    (ticket) => ticket.executionWindow === "TACTICAL"
  ).length;

  const capitalComQueueTickets = queueTickets.filter(
    (ticket) => ticket.scheduledBroker === "CAPITAL_COM"
  ).length;

  const icMarketsQueueTickets = queueTickets.filter(
    (ticket) => ticket.scheduledBroker === "IC_MARKETS"
  ).length;

  const dualBrokerQueueTickets = queueTickets.filter(
    (ticket) => ticket.scheduledBroker === "DUAL_BROKER"
  ).length;

  const totalQueueCapitalUsd = queueTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalQueuePositionSizeUsd = round(
    queueTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalQueueLotSize = round(
    queueTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const averageQueueFillQuality = round(
    queueTickets.reduce((sum, ticket) => sum + ticket.estimatedFillQuality, 0) /
      queueTickets.length
  );

  const averageQueueLatencyMs = round(
    queueTickets.reduce((sum, ticket) => sum + ticket.estimatedLatencyMs, 0) /
      queueTickets.length
  );

  const primaryQueueSpecies =
    queueTickets.find((ticket) => ticket.queuePriority === "CRITICAL")
      ?.species ?? "HYBRID";

  return {
    version: "V15.2.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_EXECUTION_TICKET_GENERATOR",
    target: "EXECUTION_QUEUE_ENGINE",
    symbol: "XAUUSD",
    totalSourceExecutionTickets: sourceExecutionTickets.length,
    totalQueueTickets: queueTickets.length,
    queueReadyTickets,
    queueLimitedTickets,
    queueBlockedTickets,
    immediateWindowTickets,
    standardWindowTickets,
    tacticalWindowTickets,
    capitalComQueueTickets,
    icMarketsQueueTickets,
    dualBrokerQueueTickets,
    totalQueueCapitalUsd,
    totalQueuePositionSizeUsd,
    totalQueueLotSize,
    averageQueueFillQuality,
    averageQueueLatencyMs,
    primaryQueueSpecies,
    queueTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Species Execution Tickets have been integrated into Execution Queue compatible tickets.",
  };
}
