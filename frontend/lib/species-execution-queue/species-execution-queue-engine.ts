import {
  ExecutionQueueSpecies,
  QueuePriority,
  SpeciesExecutionQueueReport,
  SpeciesExecutionQueueTicket,
} from "./species-execution-queue-types";

type SourceTradeAllocationItem = {
  species: ExecutionQueueSpecies;
  tradeSlots: number;
  capitalPerTradeUsd: number;
  positionSizePerTradeUsd: number;
  lotSizePerTrade: number;
  executionPermission: "ENABLED" | "LIMITED" | "DISABLED";
  queuePriority: QueuePriority;
};

const sourceTradeAllocationItems: SourceTradeAllocationItem[] = [
  {
    species: "HYBRID",
    tradeSlots: 4,
    capitalPerTradeUsd: 9750,
    positionSizePerTradeUsd: 6093.75,
    lotSizePerTrade: 0.061,
    executionPermission: "ENABLED",
    queuePriority: "PRIMARY",
  },
  {
    species: "LIQUIDITY",
    tradeSlots: 2,
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4222.22,
    lotSizePerTrade: 0.042,
    executionPermission: "ENABLED",
    queuePriority: "HIGH",
  },
  {
    species: "TREND",
    tradeSlots: 2,
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4071.43,
    lotSizePerTrade: 0.041,
    executionPermission: "ENABLED",
    queuePriority: "MEDIUM",
  },
  {
    species: "INSTITUTIONAL",
    tradeSlots: 2,
    capitalPerTradeUsd: 9500,
    positionSizePerTradeUsd: 4750,
    lotSizePerTrade: 0.048,
    executionPermission: "ENABLED",
    queuePriority: "HIGH",
  },
  {
    species: "BREAKOUT",
    tradeSlots: 1,
    capitalPerTradeUsd: 4000,
    positionSizePerTradeUsd: 555.56,
    lotSizePerTrade: 0.006,
    executionPermission: "LIMITED",
    queuePriority: "LOW",
  },
  {
    species: "MEAN_REVERSION",
    tradeSlots: 0,
    capitalPerTradeUsd: 0,
    positionSizePerTradeUsd: 0,
    lotSizePerTrade: 0,
    executionPermission: "DISABLED",
    queuePriority: "BLOCKED",
  },
];

function getPriorityScore(priority: QueuePriority): number {
  const scores: Record<QueuePriority, number> = {
    PRIMARY: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
    BLOCKED: 99,
  };

  return scores[priority];
}

function getTicketStatus(
  executionPermission: SourceTradeAllocationItem["executionPermission"]
): SpeciesExecutionQueueTicket["ticketStatus"] {
  if (executionPermission === "ENABLED") return "READY_FOR_EXECUTION";
  if (executionPermission === "LIMITED") return "LIMITED_READY";
  return "BLOCKED";
}

function getRoutingHint(
  executionPermission: SourceTradeAllocationItem["executionPermission"]
): SpeciesExecutionQueueTicket["routingHint"] {
  if (executionPermission === "ENABLED") return "EXECUTION_CENTER";
  if (executionPermission === "LIMITED") return "LIMITED_EXECUTION_CENTER";
  return "NO_ROUTE";
}

function getTicketRole(species: ExecutionQueueSpecies): string {
  const roles: Record<ExecutionQueueSpecies, string> = {
    HYBRID: "Primary adaptive execution ticket generated from Hybrid species allocation.",
    LIQUIDITY: "Liquidity-aware execution ticket with defensive routing priority.",
    TREND: "Trend-following execution ticket for directional opportunity routing.",
    INSTITUTIONAL: "Institutional-confirmation execution ticket for high-quality setups.",
    BREAKOUT: "Limited breakout execution ticket with tactical routing constraints.",
    MEAN_REVERSION: "Blocked ticket source until species allocation is restored.",
  };

  return roles[species];
}

function buildTickets(): SpeciesExecutionQueueTicket[] {
  const tickets: Omit<SpeciesExecutionQueueTicket, "executionRank">[] = [];

  sourceTradeAllocationItems.forEach((item) => {
    for (let slot = 1; slot <= item.tradeSlots; slot += 1) {
      const ticketNumber = tickets.length + 1;

      tickets.push({
        ticketId: `SPECIES-EXEC-${String(ticketNumber).padStart(3, "0")}`,
        species: item.species,
        slotNumber: slot,
        baseSymbol: "XAUUSD",
        queuePriority: item.queuePriority,
        executionPermission: item.executionPermission,
        ticketStatus: getTicketStatus(item.executionPermission),
        capitalPerTradeUsd: item.capitalPerTradeUsd,
        positionSizePerTradeUsd: item.positionSizePerTradeUsd,
        lotSizePerTrade: item.lotSizePerTrade,
        routingHint: getRoutingHint(item.executionPermission),
        ticketRole: getTicketRole(item.species),
      });
    }
  });

  return tickets
    .sort((a, b) => getPriorityScore(a.queuePriority) - getPriorityScore(b.queuePriority))
    .map((ticket, index) => ({
      ...ticket,
      executionRank: index + 1,
    }));
}

export function getSpeciesExecutionQueueReport(): SpeciesExecutionQueueReport {
  const queueTickets = buildTickets();

  const readyTickets = queueTickets.filter(
    (ticket) => ticket.ticketStatus === "READY_FOR_EXECUTION"
  ).length;

  const limitedTickets = queueTickets.filter(
    (ticket) => ticket.ticketStatus === "LIMITED_READY"
  ).length;

  const blockedTickets = queueTickets.filter(
    (ticket) => ticket.ticketStatus === "BLOCKED"
  ).length;

  const primarySpecies =
    queueTickets.find((ticket) => ticket.queuePriority === "PRIMARY")?.species ??
    "HYBRID";

  const blockedSpecies = sourceTradeAllocationItems
    .filter((item) => item.executionPermission === "DISABLED")
    .map((item) => item.species);

  return {
    version: "V14.7.0",
    status: "READY",
    mode: "SIMULATION",
    baseSymbol: "XAUUSD",
    totalQueueTickets: queueTickets.length,
    readyTickets,
    limitedTickets,
    blockedTickets,
    primarySpecies,
    queueTickets,
    blockedSpecies,
    summary:
      "Species trade allocations have been converted into ranked execution queue tickets for the Execution Center.",
  };
}
