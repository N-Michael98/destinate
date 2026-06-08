import {
  ExecutionCenterSyncSpecies,
  SpeciesExecutionCenterSyncReport,
  SpeciesExecutionCenterSyncTicket,
} from "./species-execution-center-sync-types";

type SourceQueueTicket = {
  ticketId: string;
  species: ExecutionCenterSyncSpecies;
  queuePriority: "PRIMARY" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  ticketStatus: "READY_FOR_EXECUTION" | "LIMITED_READY" | "BLOCKED";
  capitalPerTradeUsd: number;
  positionSizePerTradeUsd: number;
  lotSizePerTrade: number;
  executionRank: number;
};

const sourceQueueTickets: SourceQueueTicket[] = [
  {
    ticketId: "SPECIES-EXEC-001",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9750,
    positionSizePerTradeUsd: 6093.75,
    lotSizePerTrade: 0.061,
    executionRank: 1,
  },
  {
    ticketId: "SPECIES-EXEC-002",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9750,
    positionSizePerTradeUsd: 6093.75,
    lotSizePerTrade: 0.061,
    executionRank: 2,
  },
  {
    ticketId: "SPECIES-EXEC-003",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9750,
    positionSizePerTradeUsd: 6093.75,
    lotSizePerTrade: 0.061,
    executionRank: 3,
  },
  {
    ticketId: "SPECIES-EXEC-004",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9750,
    positionSizePerTradeUsd: 6093.75,
    lotSizePerTrade: 0.061,
    executionRank: 4,
  },
  {
    ticketId: "SPECIES-EXEC-005",
    species: "LIQUIDITY",
    queuePriority: "HIGH",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4222.22,
    lotSizePerTrade: 0.042,
    executionRank: 5,
  },
  {
    ticketId: "SPECIES-EXEC-006",
    species: "LIQUIDITY",
    queuePriority: "HIGH",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4222.22,
    lotSizePerTrade: 0.042,
    executionRank: 6,
  },
  {
    ticketId: "SPECIES-EXEC-009",
    species: "INSTITUTIONAL",
    queuePriority: "HIGH",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4750,
    lotSizePerTrade: 0.048,
    executionRank: 7,
  },
  {
    ticketId: "SPECIES-EXEC-010",
    species: "INSTITUTIONAL",
    queuePriority: "HIGH",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4750,
    lotSizePerTrade: 0.048,
    executionRank: 8,
  },
  {
    ticketId: "SPECIES-EXEC-007",
    species: "TREND",
    queuePriority: "MEDIUM",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4071.43,
    lotSizePerTrade: 0.041,
    executionRank: 9,
  },
  {
    ticketId: "SPECIES-EXEC-008",
    species: "TREND",
    queuePriority: "MEDIUM",
    ticketStatus: "READY_FOR_EXECUTION",
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4071.43,
    lotSizePerTrade: 0.041,
    executionRank: 10,
  },
  {
    ticketId: "SPECIES-EXEC-011",
    species: "BREAKOUT",
    queuePriority: "LOW",
    ticketStatus: "LIMITED_READY",
    capitalPerTradeUsd: 4000,
    positionSizePerTradeUsd: 555.56,
    lotSizePerTrade: 0.006,
    executionRank: 11,
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getTicketStatus(
  status: SourceQueueTicket["ticketStatus"]
): SpeciesExecutionCenterSyncTicket["ticketStatus"] {
  if (status === "READY_FOR_EXECUTION") return "SYNCED_READY";
  if (status === "LIMITED_READY") return "SYNCED_LIMITED";
  return "SYNC_BLOCKED";
}

function getDestination(
  status: SourceQueueTicket["ticketStatus"]
): SpeciesExecutionCenterSyncTicket["destination"] {
  if (status === "READY_FOR_EXECUTION") return "EXECUTION_QUEUE_ENGINE";
  if (status === "LIMITED_READY") return "LIMITED_EXECUTION_QUEUE_ENGINE";
  return "NO_EXECUTION_ROUTE";
}

function getSyncRole(species: ExecutionCenterSyncSpecies): string {
  const roles: Record<ExecutionCenterSyncSpecies, string> = {
    HYBRID: "Primary Evolution ticket synced into Execution Center routing.",
    LIQUIDITY: "Liquidity-aware ticket synced with defensive execution priority.",
    TREND: "Trend-following ticket synced for directional execution readiness.",
    INSTITUTIONAL: "Institutional-confirmation ticket synced into execution flow.",
    BREAKOUT: "Limited tactical breakout ticket synced with restricted routing.",
    MEAN_REVERSION: "Blocked species without Execution Center sync route.",
  };

  return roles[species];
}

export function getSpeciesExecutionCenterSyncReport(): SpeciesExecutionCenterSyncReport {
  const syncTickets: SpeciesExecutionCenterSyncTicket[] = sourceQueueTickets.map(
    (ticket) => ({
      sourceTicketId: ticket.ticketId,
      executionCenterTicketId: ticket.ticketId.replace(
        "SPECIES-EXEC",
        "EXEC-CENTER-SPECIES"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      queuePriority: ticket.queuePriority,
      executionRank: ticket.executionRank,
      capitalUsd: ticket.capitalPerTradeUsd,
      positionSizeUsd: ticket.positionSizePerTradeUsd,
      lotSize: ticket.lotSizePerTrade,
      ticketStatus: getTicketStatus(ticket.ticketStatus),
      destination: getDestination(ticket.ticketStatus),
      tradeApprovalRequired: true,
      brokerRoutingRequired: true,
      syncRole: getSyncRole(ticket.species),
    })
  );

  const readySyncedTickets = syncTickets.filter(
    (ticket) => ticket.ticketStatus === "SYNCED_READY"
  ).length;

  const limitedSyncedTickets = syncTickets.filter(
    (ticket) => ticket.ticketStatus === "SYNCED_LIMITED"
  ).length;

  const blockedSyncedTickets = syncTickets.filter(
    (ticket) => ticket.ticketStatus === "SYNC_BLOCKED"
  ).length;

  const totalSyncedCapitalUsd = syncTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalSyncedPositionSizeUsd = round(
    syncTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalSyncedLotSize = round(
    syncTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const primarySpecies =
    syncTickets.find((ticket) => ticket.queuePriority === "PRIMARY")?.species ??
    "HYBRID";

  return {
    version: "V14.8.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_EXECUTION_QUEUE",
    target: "EXECUTION_CENTER",
    symbol: "XAUUSD",
    totalSourceTickets: sourceQueueTickets.length,
    totalSyncedTickets: syncTickets.length,
    readySyncedTickets,
    limitedSyncedTickets,
    blockedSyncedTickets,
    totalSyncedCapitalUsd,
    totalSyncedPositionSizeUsd,
    totalSyncedLotSize,
    primarySpecies,
    syncTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Species Execution Queue tickets have been transformed into Execution Center compatible sync tickets.",
  };
}
