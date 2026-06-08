import {
  ApprovalPriority,
  SpeciesTradeApprovalSyncReport,
  SpeciesTradeApprovalSyncTicket,
  TradeApprovalSyncSpecies,
} from "./species-trade-approval-sync-types";

type SourceExecutionCenterTicket = {
  executionCenterTicketId: string;
  species: TradeApprovalSyncSpecies;
  queuePriority: "PRIMARY" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  ticketStatus: "SYNCED_READY" | "SYNCED_LIMITED" | "SYNC_BLOCKED";
};

const sourceExecutionCenterTickets: SourceExecutionCenterTicket[] = [
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-001",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    executionRank: 1,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-002",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    executionRank: 2,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-003",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    executionRank: 3,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-004",
    species: "HYBRID",
    queuePriority: "PRIMARY",
    executionRank: 4,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-005",
    species: "LIQUIDITY",
    queuePriority: "HIGH",
    executionRank: 5,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-006",
    species: "LIQUIDITY",
    queuePriority: "HIGH",
    executionRank: 6,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-009",
    species: "INSTITUTIONAL",
    queuePriority: "HIGH",
    executionRank: 7,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-010",
    species: "INSTITUTIONAL",
    queuePriority: "HIGH",
    executionRank: 8,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-007",
    species: "TREND",
    queuePriority: "MEDIUM",
    executionRank: 9,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-008",
    species: "TREND",
    queuePriority: "MEDIUM",
    executionRank: 10,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    ticketStatus: "SYNCED_READY",
  },
  {
    executionCenterTicketId: "EXEC-CENTER-SPECIES-011",
    species: "BREAKOUT",
    queuePriority: "LOW",
    executionRank: 11,
    capitalUsd: 4000,
    positionSizeUsd: 555.56,
    lotSize: 0.006,
    ticketStatus: "SYNCED_LIMITED",
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getApprovalPriority(
  priority: SourceExecutionCenterTicket["queuePriority"]
): ApprovalPriority {
  const priorityMap: Record<
    SourceExecutionCenterTicket["queuePriority"],
    ApprovalPriority
  > = {
    PRIMARY: "CRITICAL",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
    BLOCKED: "BLOCKED",
  };

  return priorityMap[priority];
}

function getApprovalStatus(
  ticketStatus: SourceExecutionCenterTicket["ticketStatus"]
): SpeciesTradeApprovalSyncTicket["approvalStatus"] {
  if (ticketStatus === "SYNCED_READY") return "APPROVAL_READY";
  if (ticketStatus === "SYNCED_LIMITED") return "APPROVAL_LIMITED";
  return "APPROVAL_BLOCKED";
}

function getApprovalRole(species: TradeApprovalSyncSpecies): string {
  const roles: Record<TradeApprovalSyncSpecies, string> = {
    HYBRID: "Critical Hybrid approval ticket for primary Evolution execution.",
    LIQUIDITY: "Liquidity-aware approval ticket with defensive risk validation.",
    TREND: "Trend-following approval ticket requiring directional confirmation.",
    INSTITUTIONAL: "Institutional approval ticket requiring quality confirmation.",
    BREAKOUT: "Limited breakout approval ticket with tactical risk constraints.",
    MEAN_REVERSION: "Approval blocked until species allocation is restored.",
  };

  return roles[species];
}

export function getSpeciesTradeApprovalSyncReport(): SpeciesTradeApprovalSyncReport {
  const approvalTickets: SpeciesTradeApprovalSyncTicket[] =
    sourceExecutionCenterTickets.map((ticket) => ({
      sourceExecutionCenterTicketId: ticket.executionCenterTicketId,
      tradeApprovalTicketId: ticket.executionCenterTicketId.replace(
        "EXEC-CENTER",
        "TRADE-APPROVAL"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      approvalPriority: getApprovalPriority(ticket.queuePriority),
      executionRank: ticket.executionRank,
      capitalUsd: ticket.capitalUsd,
      positionSizeUsd: ticket.positionSizeUsd,
      lotSize: ticket.lotSize,
      approvalStatus: getApprovalStatus(ticket.ticketStatus),
      riskGateRequired: true,
      brokerRoutingGateRequired: true,
      executionQueueRequired: true,
      maxRiskAllowed: ticket.positionSizeUsd <= 10000,
      approvalRole: getApprovalRole(ticket.species),
    }));

  const approvalReadyTickets = approvalTickets.filter(
    (ticket) => ticket.approvalStatus === "APPROVAL_READY"
  ).length;

  const approvalLimitedTickets = approvalTickets.filter(
    (ticket) => ticket.approvalStatus === "APPROVAL_LIMITED"
  ).length;

  const approvalBlockedTickets = approvalTickets.filter(
    (ticket) => ticket.approvalStatus === "APPROVAL_BLOCKED"
  ).length;

  const totalApprovalCapitalUsd = approvalTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalApprovalPositionSizeUsd = round(
    approvalTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalApprovalLotSize = round(
    approvalTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const primarySpecies =
    approvalTickets.find((ticket) => ticket.approvalPriority === "CRITICAL")
      ?.species ?? "HYBRID";

  return {
    version: "V14.9.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_EXECUTION_CENTER_SYNC",
    target: "TRADE_APPROVAL_ENGINE",
    symbol: "XAUUSD",
    totalSourceTickets: sourceExecutionCenterTickets.length,
    totalApprovalTickets: approvalTickets.length,
    approvalReadyTickets,
    approvalLimitedTickets,
    approvalBlockedTickets,
    totalApprovalCapitalUsd,
    totalApprovalPositionSizeUsd,
    totalApprovalLotSize,
    primarySpecies,
    approvalTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Execution Center sync tickets have been transformed into Trade Approval compatible tickets with approval gates.",
  };
}
