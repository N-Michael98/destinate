import {
  BrokerRoutingPriority,
  BrokerRoutingSpecies,
  SpeciesBrokerRoutingSyncReport,
  SpeciesBrokerRoutingSyncTicket,
  SupportedBroker,
} from "./species-broker-routing-sync-types";

type SourceApprovalTicket = {
  tradeApprovalTicketId: string;
  species: BrokerRoutingSpecies;
  approvalPriority: BrokerRoutingPriority;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  approvalStatus: "APPROVAL_READY" | "APPROVAL_LIMITED" | "APPROVAL_BLOCKED";
};

const sourceApprovalTickets: SourceApprovalTicket[] = [
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-001",
    species: "HYBRID",
    approvalPriority: "CRITICAL",
    executionRank: 1,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-002",
    species: "HYBRID",
    approvalPriority: "CRITICAL",
    executionRank: 2,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-003",
    species: "HYBRID",
    approvalPriority: "CRITICAL",
    executionRank: 3,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-004",
    species: "HYBRID",
    approvalPriority: "CRITICAL",
    executionRank: 4,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-005",
    species: "LIQUIDITY",
    approvalPriority: "HIGH",
    executionRank: 5,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-006",
    species: "LIQUIDITY",
    approvalPriority: "HIGH",
    executionRank: 6,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-009",
    species: "INSTITUTIONAL",
    approvalPriority: "HIGH",
    executionRank: 7,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-010",
    species: "INSTITUTIONAL",
    approvalPriority: "HIGH",
    executionRank: 8,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-007",
    species: "TREND",
    approvalPriority: "MEDIUM",
    executionRank: 9,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-008",
    species: "TREND",
    approvalPriority: "MEDIUM",
    executionRank: 10,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    approvalStatus: "APPROVAL_READY",
  },
  {
    tradeApprovalTicketId: "TRADE-APPROVAL-SPECIES-011",
    species: "BREAKOUT",
    approvalPriority: "LOW",
    executionRank: 11,
    capitalUsd: 4000,
    positionSizeUsd: 555.56,
    lotSize: 0.006,
    approvalStatus: "APPROVAL_LIMITED",
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getPreferredBroker(species: BrokerRoutingSpecies): SupportedBroker {
  const brokers: Record<BrokerRoutingSpecies, SupportedBroker> = {
    HYBRID: "DUAL_BROKER",
    LIQUIDITY: "CAPITAL_COM",
    TREND: "IC_MARKETS",
    INSTITUTIONAL: "DUAL_BROKER",
    BREAKOUT: "IC_MARKETS",
    MEAN_REVERSION: "NO_BROKER",
  };

  return brokers[species];
}

function getBackupBroker(species: BrokerRoutingSpecies): SupportedBroker {
  const brokers: Record<BrokerRoutingSpecies, SupportedBroker> = {
    HYBRID: "CAPITAL_COM",
    LIQUIDITY: "IC_MARKETS",
    TREND: "CAPITAL_COM",
    INSTITUTIONAL: "IC_MARKETS",
    BREAKOUT: "CAPITAL_COM",
    MEAN_REVERSION: "NO_BROKER",
  };

  return brokers[species];
}

function getRoutingStatus(
  approvalStatus: SourceApprovalTicket["approvalStatus"]
): SpeciesBrokerRoutingSyncTicket["routingStatus"] {
  if (approvalStatus === "APPROVAL_READY") return "ROUTING_READY";
  if (approvalStatus === "APPROVAL_LIMITED") return "ROUTING_LIMITED";
  return "ROUTING_BLOCKED";
}

function getExecutionDestination(
  approvalStatus: SourceApprovalTicket["approvalStatus"]
): SpeciesBrokerRoutingSyncTicket["executionDestination"] {
  if (approvalStatus === "APPROVAL_READY") return "BROKER_ROUTING_LAYER";
  if (approvalStatus === "APPROVAL_LIMITED") return "LIMITED_BROKER_ROUTING_LAYER";
  return "NO_ROUTE";
}

function getBrokerConfidence(species: BrokerRoutingSpecies): number {
  const confidence: Record<BrokerRoutingSpecies, number> = {
    HYBRID: 92,
    LIQUIDITY: 88,
    TREND: 84,
    INSTITUTIONAL: 90,
    BREAKOUT: 72,
    MEAN_REVERSION: 0,
  };

  return confidence[species];
}

function getRoutingRole(species: BrokerRoutingSpecies): string {
  const roles: Record<BrokerRoutingSpecies, string> = {
    HYBRID: "Critical Hybrid ticket routed through dual-broker execution logic.",
    LIQUIDITY: "Liquidity-aware ticket routed with Capital.com preference.",
    TREND: "Trend-following ticket routed with IC Markets preference.",
    INSTITUTIONAL: "Institutional ticket routed through dual-broker validation.",
    BREAKOUT: "Limited breakout ticket routed with tactical IC Markets preference.",
    MEAN_REVERSION: "Broker routing blocked until species becomes active again.",
  };

  return roles[species];
}

export function getSpeciesBrokerRoutingSyncReport(): SpeciesBrokerRoutingSyncReport {
  const routingTickets: SpeciesBrokerRoutingSyncTicket[] = sourceApprovalTickets.map(
    (ticket) => ({
      sourceTradeApprovalTicketId: ticket.tradeApprovalTicketId,
      brokerRoutingTicketId: ticket.tradeApprovalTicketId.replace(
        "TRADE-APPROVAL",
        "BROKER-ROUTE"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      preferredBroker: getPreferredBroker(ticket.species),
      backupBroker: getBackupBroker(ticket.species),
      routingPriority: ticket.approvalPriority,
      routingStatus: getRoutingStatus(ticket.approvalStatus),
      executionDestination: getExecutionDestination(ticket.approvalStatus),
      brokerConfidence: getBrokerConfidence(ticket.species),
      capitalUsd: ticket.capitalUsd,
      positionSizeUsd: ticket.positionSizeUsd,
      lotSize: ticket.lotSize,
      executionRank: ticket.executionRank,
      approvalStatus: ticket.approvalStatus,
      routingRole: getRoutingRole(ticket.species),
    })
  );

  const routingReadyTickets = routingTickets.filter(
    (ticket) => ticket.routingStatus === "ROUTING_READY"
  ).length;

  const routingLimitedTickets = routingTickets.filter(
    (ticket) => ticket.routingStatus === "ROUTING_LIMITED"
  ).length;

  const routingBlockedTickets = routingTickets.filter(
    (ticket) => ticket.routingStatus === "ROUTING_BLOCKED"
  ).length;

  const capitalComTickets = routingTickets.filter(
    (ticket) => ticket.preferredBroker === "CAPITAL_COM"
  ).length;

  const icMarketsTickets = routingTickets.filter(
    (ticket) => ticket.preferredBroker === "IC_MARKETS"
  ).length;

  const dualBrokerTickets = routingTickets.filter(
    (ticket) => ticket.preferredBroker === "DUAL_BROKER"
  ).length;

  const totalRoutingCapitalUsd = routingTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalRoutingPositionSizeUsd = round(
    routingTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalRoutingLotSize = round(
    routingTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const primaryBrokerSpecies =
    routingTickets.find((ticket) => ticket.routingPriority === "CRITICAL")
      ?.species ?? "HYBRID";

  return {
    version: "V15.0.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_TRADE_APPROVAL_SYNC",
    target: "BROKER_ROUTING_LAYER",
    symbol: "XAUUSD",
    totalSourceTickets: sourceApprovalTickets.length,
    totalRoutingTickets: routingTickets.length,
    routingReadyTickets,
    routingLimitedTickets,
    routingBlockedTickets,
    capitalComTickets,
    icMarketsTickets,
    dualBrokerTickets,
    totalRoutingCapitalUsd,
    totalRoutingPositionSizeUsd,
    totalRoutingLotSize,
    primaryBrokerSpecies,
    routingTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Species Trade Approval tickets have been transformed into Broker Routing compatible tickets with broker preferences.",
  };
}
