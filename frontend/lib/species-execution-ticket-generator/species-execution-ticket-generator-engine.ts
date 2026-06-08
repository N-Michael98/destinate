import {
  ExecutionBroker,
  ExecutionPriority,
  ExecutionTicketSpecies,
  SpeciesExecutionTicket,
  SpeciesExecutionTicketGeneratorReport,
} from "./species-execution-ticket-generator-types";

type SourceBrokerRoutingTicket = {
  brokerRoutingTicketId: string;
  species: ExecutionTicketSpecies;
  preferredBroker: ExecutionBroker;
  backupBroker: ExecutionBroker;
  routingPriority: ExecutionPriority;
  routingStatus: "ROUTING_READY" | "ROUTING_LIMITED" | "ROUTING_BLOCKED";
  brokerConfidence: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  executionRank: number;
};

const sourceBrokerRoutingTickets: SourceBrokerRoutingTicket[] = [
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-001",
    species: "HYBRID",
    preferredBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    routingPriority: "CRITICAL",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 92,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    executionRank: 1,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-002",
    species: "HYBRID",
    preferredBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    routingPriority: "CRITICAL",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 92,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    executionRank: 2,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-003",
    species: "HYBRID",
    preferredBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    routingPriority: "CRITICAL",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 92,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    executionRank: 3,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-004",
    species: "HYBRID",
    preferredBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    routingPriority: "CRITICAL",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 92,
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    executionRank: 4,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-005",
    species: "LIQUIDITY",
    preferredBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    routingPriority: "HIGH",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 88,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    executionRank: 5,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-006",
    species: "LIQUIDITY",
    preferredBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    routingPriority: "HIGH",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 88,
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    executionRank: 6,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-009",
    species: "INSTITUTIONAL",
    preferredBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    routingPriority: "HIGH",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 90,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    executionRank: 7,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-010",
    species: "INSTITUTIONAL",
    preferredBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    routingPriority: "HIGH",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 90,
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    executionRank: 8,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-007",
    species: "TREND",
    preferredBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    routingPriority: "MEDIUM",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 84,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    executionRank: 9,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-008",
    species: "TREND",
    preferredBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    routingPriority: "MEDIUM",
    routingStatus: "ROUTING_READY",
    brokerConfidence: 84,
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    executionRank: 10,
  },
  {
    brokerRoutingTicketId: "BROKER-ROUTE-SPECIES-011",
    species: "BREAKOUT",
    preferredBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    routingPriority: "LOW",
    routingStatus: "ROUTING_LIMITED",
    brokerConfidence: 72,
    capitalUsd: 4000,
    positionSizeUsd: 555.56,
    lotSize: 0.006,
    executionRank: 11,
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getExecutionStatus(
  routingStatus: SourceBrokerRoutingTicket["routingStatus"]
): SpeciesExecutionTicket["executionStatus"] {
  if (routingStatus === "ROUTING_READY") return "EXECUTION_READY";
  if (routingStatus === "ROUTING_LIMITED") return "EXECUTION_LIMITED";
  return "EXECUTION_BLOCKED";
}

function getExecutionQueueTarget(
  routingStatus: SourceBrokerRoutingTicket["routingStatus"]
): SpeciesExecutionTicket["executionQueueTarget"] {
  if (routingStatus === "ROUTING_READY") return "EXECUTION_QUEUE_ENGINE";
  if (routingStatus === "ROUTING_LIMITED") return "LIMITED_EXECUTION_QUEUE_ENGINE";
  return "NO_EXECUTION_QUEUE";
}

function getEstimatedLatencyMs(broker: ExecutionBroker): number {
  const latency: Record<ExecutionBroker, number> = {
    CAPITAL_COM: 92,
    IC_MARKETS: 71,
    DUAL_BROKER: 84,
    NO_BROKER: 0,
  };

  return latency[broker];
}

function getEstimatedFillQuality(
  brokerConfidence: number,
  broker: ExecutionBroker
): number {
  const brokerBoost: Record<ExecutionBroker, number> = {
    CAPITAL_COM: 2,
    IC_MARKETS: 4,
    DUAL_BROKER: 5,
    NO_BROKER: 0,
  };

  return Math.min(100, brokerConfidence + brokerBoost[broker]);
}

function getExecutionRole(species: ExecutionTicketSpecies): string {
  const roles: Record<ExecutionTicketSpecies, string> = {
    HYBRID: "Critical Hybrid execution ticket generated from dual-broker routing.",
    LIQUIDITY: "Liquidity-aware execution ticket prepared for defensive routing.",
    TREND: "Trend-following execution ticket prepared for directional routing.",
    INSTITUTIONAL: "Institutional execution ticket prepared with dual-broker validation.",
    BREAKOUT: "Limited breakout execution ticket prepared with tactical constraints.",
    MEAN_REVERSION: "Execution ticket blocked until species becomes active.",
  };

  return roles[species];
}

export function getSpeciesExecutionTicketGeneratorReport(): SpeciesExecutionTicketGeneratorReport {
  const executionTickets: SpeciesExecutionTicket[] = sourceBrokerRoutingTickets.map(
    (ticket) => ({
      sourceBrokerRoutingTicketId: ticket.brokerRoutingTicketId,
      executionTicketId: ticket.brokerRoutingTicketId.replace(
        "BROKER-ROUTE",
        "EXEC-TICKET"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      executionBroker: ticket.preferredBroker,
      backupBroker: ticket.backupBroker,
      executionStatus: getExecutionStatus(ticket.routingStatus),
      executionPriority: ticket.routingPriority,
      executionRank: ticket.executionRank,
      capitalUsd: ticket.capitalUsd,
      positionSizeUsd: ticket.positionSizeUsd,
      lotSize: ticket.lotSize,
      estimatedFillQuality: getEstimatedFillQuality(
        ticket.brokerConfidence,
        ticket.preferredBroker
      ),
      estimatedLatencyMs: getEstimatedLatencyMs(ticket.preferredBroker),
      brokerConfidence: ticket.brokerConfidence,
      readyForExecution: ticket.routingStatus === "ROUTING_READY",
      executionQueueTarget: getExecutionQueueTarget(ticket.routingStatus),
      executionRole: getExecutionRole(ticket.species),
    })
  );

  const executionReadyTickets = executionTickets.filter(
    (ticket) => ticket.executionStatus === "EXECUTION_READY"
  ).length;

  const executionLimitedTickets = executionTickets.filter(
    (ticket) => ticket.executionStatus === "EXECUTION_LIMITED"
  ).length;

  const executionBlockedTickets = executionTickets.filter(
    (ticket) => ticket.executionStatus === "EXECUTION_BLOCKED"
  ).length;

  const capitalComExecutionTickets = executionTickets.filter(
    (ticket) => ticket.executionBroker === "CAPITAL_COM"
  ).length;

  const icMarketsExecutionTickets = executionTickets.filter(
    (ticket) => ticket.executionBroker === "IC_MARKETS"
  ).length;

  const dualBrokerExecutionTickets = executionTickets.filter(
    (ticket) => ticket.executionBroker === "DUAL_BROKER"
  ).length;

  const totalExecutionCapitalUsd = executionTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalExecutionPositionSizeUsd = round(
    executionTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalExecutionLotSize = round(
    executionTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const averageFillQuality = round(
    executionTickets.reduce((sum, ticket) => sum + ticket.estimatedFillQuality, 0) /
      executionTickets.length
  );

  const averageLatencyMs = round(
    executionTickets.reduce((sum, ticket) => sum + ticket.estimatedLatencyMs, 0) /
      executionTickets.length
  );

  const primaryExecutionSpecies =
    executionTickets.find((ticket) => ticket.executionPriority === "CRITICAL")
      ?.species ?? "HYBRID";

  return {
    version: "V15.1.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_BROKER_ROUTING_SYNC",
    target: "EXECUTION_TICKET_GENERATOR",
    symbol: "XAUUSD",
    totalSourceRoutingTickets: sourceBrokerRoutingTickets.length,
    totalExecutionTickets: executionTickets.length,
    executionReadyTickets,
    executionLimitedTickets,
    executionBlockedTickets,
    capitalComExecutionTickets,
    icMarketsExecutionTickets,
    dualBrokerExecutionTickets,
    totalExecutionCapitalUsd,
    totalExecutionPositionSizeUsd,
    totalExecutionLotSize,
    averageFillQuality,
    averageLatencyMs,
    primaryExecutionSpecies,
    executionTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Broker Routing tickets have been converted into executable Species Execution Tickets for the Execution Queue Engine.",
  };
}
