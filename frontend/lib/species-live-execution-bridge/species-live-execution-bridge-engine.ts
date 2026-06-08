import {
  BridgePriority,
  LiveBridgeBroker,
  LiveBridgeSpecies,
  SpeciesLiveExecutionBridgeReport,
  SpeciesLiveExecutionBridgeTicket,
} from "./species-live-execution-bridge-types";

type SourceQueueTicket = {
  queueTicketId: string;
  species: LiveBridgeSpecies;
  queueStatus: "QUEUE_READY" | "QUEUE_LIMITED" | "QUEUE_BLOCKED";
  queuePriority: BridgePriority;
  queuePosition: number;
  executionWindow: "IMMEDIATE" | "STANDARD" | "TACTICAL" | "BLOCKED";
  scheduledBroker: LiveBridgeBroker;
  backupBroker: LiveBridgeBroker;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  queueReady: boolean;
  queueTarget:
    | "EXECUTION_QUEUE_ENGINE"
    | "LIMITED_EXECUTION_QUEUE_ENGINE"
    | "NO_EXECUTION_QUEUE";
};

const sourceQueueTickets: SourceQueueTicket[] = [
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-001",
    species: "HYBRID",
    queueStatus: "QUEUE_READY",
    queuePriority: "CRITICAL",
    queuePosition: 1,
    executionWindow: "IMMEDIATE",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-002",
    species: "HYBRID",
    queueStatus: "QUEUE_READY",
    queuePriority: "CRITICAL",
    queuePosition: 2,
    executionWindow: "IMMEDIATE",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-003",
    species: "HYBRID",
    queueStatus: "QUEUE_READY",
    queuePriority: "CRITICAL",
    queuePosition: 3,
    executionWindow: "IMMEDIATE",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-004",
    species: "HYBRID",
    queueStatus: "QUEUE_READY",
    queuePriority: "CRITICAL",
    queuePosition: 4,
    executionWindow: "IMMEDIATE",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-005",
    species: "LIQUIDITY",
    queueStatus: "QUEUE_READY",
    queuePriority: "HIGH",
    queuePosition: 5,
    executionWindow: "STANDARD",
    scheduledBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    estimatedFillQuality: 90,
    estimatedLatencyMs: 92,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-006",
    species: "LIQUIDITY",
    queueStatus: "QUEUE_READY",
    queuePriority: "HIGH",
    queuePosition: 6,
    executionWindow: "STANDARD",
    scheduledBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    estimatedFillQuality: 90,
    estimatedLatencyMs: 92,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-009",
    species: "INSTITUTIONAL",
    queueStatus: "QUEUE_READY",
    queuePriority: "HIGH",
    queuePosition: 7,
    executionWindow: "STANDARD",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    estimatedFillQuality: 95,
    estimatedLatencyMs: 84,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-010",
    species: "INSTITUTIONAL",
    queueStatus: "QUEUE_READY",
    queuePriority: "HIGH",
    queuePosition: 8,
    executionWindow: "STANDARD",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    estimatedFillQuality: 95,
    estimatedLatencyMs: 84,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-007",
    species: "TREND",
    queueStatus: "QUEUE_READY",
    queuePriority: "MEDIUM",
    queuePosition: 9,
    executionWindow: "STANDARD",
    scheduledBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    estimatedFillQuality: 88,
    estimatedLatencyMs: 71,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-008",
    species: "TREND",
    queueStatus: "QUEUE_READY",
    queuePriority: "MEDIUM",
    queuePosition: 10,
    executionWindow: "STANDARD",
    scheduledBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    estimatedFillQuality: 88,
    estimatedLatencyMs: 71,
    queueReady: true,
    queueTarget: "EXECUTION_QUEUE_ENGINE",
  },
  {
    queueTicketId: "QUEUE-TICKET-SPECIES-011",
    species: "BREAKOUT",
    queueStatus: "QUEUE_LIMITED",
    queuePriority: "LOW",
    queuePosition: 11,
    executionWindow: "TACTICAL",
    scheduledBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    capitalUsd: 4000,
    positionSizeUsd: 555.56,
    lotSize: 0.006,
    estimatedFillQuality: 76,
    estimatedLatencyMs: 71,
    queueReady: false,
    queueTarget: "LIMITED_EXECUTION_QUEUE_ENGINE",
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getBridgeStatus(
  queueStatus: SourceQueueTicket["queueStatus"]
): SpeciesLiveExecutionBridgeTicket["bridgeStatus"] {
  if (queueStatus === "QUEUE_READY") return "LIVE_EXECUTION_READY";
  if (queueStatus === "QUEUE_LIMITED") return "LIVE_EXECUTION_LIMITED";
  return "LIVE_EXECUTION_BLOCKED";
}

function getHandshakeStatus(
  queueStatus: SourceQueueTicket["queueStatus"]
): SpeciesLiveExecutionBridgeTicket["brokerHandshakeStatus"] {
  if (queueStatus === "QUEUE_READY") return "HANDSHAKE_READY";
  if (queueStatus === "QUEUE_LIMITED") return "HANDSHAKE_LIMITED";
  return "HANDSHAKE_BLOCKED";
}

function getBridgeHealth(
  queueStatus: SourceQueueTicket["queueStatus"]
): SpeciesLiveExecutionBridgeTicket["executionBridgeHealth"] {
  if (queueStatus === "QUEUE_READY") return "HEALTHY";
  if (queueStatus === "QUEUE_LIMITED") return "DEGRADED";
  return "BLOCKED";
}

function getExecutionRoute(
  queueTarget: SourceQueueTicket["queueTarget"]
): SpeciesLiveExecutionBridgeTicket["executionRoute"] {
  if (queueTarget === "EXECUTION_QUEUE_ENGINE") return "EXECUTION_QUEUE_ENGINE";
  if (queueTarget === "LIMITED_EXECUTION_QUEUE_ENGINE") {
    return "LIMITED_EXECUTION_QUEUE_ENGINE";
  }

  return "NO_EXECUTION_ROUTE";
}

function getBridgeRole(species: LiveBridgeSpecies): string {
  const roles: Record<LiveBridgeSpecies, string> = {
    HYBRID: "Critical Hybrid bridge ticket connected to live execution simulation.",
    LIQUIDITY: "Liquidity-aware bridge ticket connected to defensive live execution flow.",
    TREND: "Trend-following bridge ticket connected to directional live execution flow.",
    INSTITUTIONAL: "Institutional bridge ticket connected to validated live execution flow.",
    BREAKOUT: "Limited breakout bridge ticket connected with tactical restrictions.",
    MEAN_REVERSION: "Live bridge blocked until species allocation is restored.",
  };

  return roles[species];
}

export function getSpeciesLiveExecutionBridgeReport(): SpeciesLiveExecutionBridgeReport {
  const bridgeTickets: SpeciesLiveExecutionBridgeTicket[] = sourceQueueTickets.map(
    (ticket) => ({
      sourceQueueTicketId: ticket.queueTicketId,
      bridgeTicketId: ticket.queueTicketId.replace(
        "QUEUE-TICKET",
        "BRIDGE-TICKET"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      bridgeStatus: getBridgeStatus(ticket.queueStatus),
      liveExecutionReady: ticket.queueReady,
      executionRoute: getExecutionRoute(ticket.queueTarget),
      executionMode: "LIVE_BRIDGE_SIMULATION",
      brokerHandshakeStatus: getHandshakeStatus(ticket.queueStatus),
      executionBridgeHealth: getBridgeHealth(ticket.queueStatus),
      bridgePriority: ticket.queuePriority,
      scheduledBroker: ticket.scheduledBroker,
      backupBroker: ticket.backupBroker,
      queuePosition: ticket.queuePosition,
      executionWindow: ticket.executionWindow,
      capitalUsd: ticket.capitalUsd,
      positionSizeUsd: ticket.positionSizeUsd,
      lotSize: ticket.lotSize,
      estimatedFillQuality: ticket.estimatedFillQuality,
      estimatedLatencyMs: ticket.estimatedLatencyMs,
      bridgeRole: getBridgeRole(ticket.species),
    })
  );

  const liveReadyTickets = bridgeTickets.filter(
    (ticket) => ticket.bridgeStatus === "LIVE_EXECUTION_READY"
  ).length;

  const liveLimitedTickets = bridgeTickets.filter(
    (ticket) => ticket.bridgeStatus === "LIVE_EXECUTION_LIMITED"
  ).length;

  const liveBlockedTickets = bridgeTickets.filter(
    (ticket) => ticket.bridgeStatus === "LIVE_EXECUTION_BLOCKED"
  ).length;

  const healthyBridgeTickets = bridgeTickets.filter(
    (ticket) => ticket.executionBridgeHealth === "HEALTHY"
  ).length;

  const degradedBridgeTickets = bridgeTickets.filter(
    (ticket) => ticket.executionBridgeHealth === "DEGRADED"
  ).length;

  const blockedBridgeTickets = bridgeTickets.filter(
    (ticket) => ticket.executionBridgeHealth === "BLOCKED"
  ).length;

  const handshakeReadyTickets = bridgeTickets.filter(
    (ticket) => ticket.brokerHandshakeStatus === "HANDSHAKE_READY"
  ).length;

  const handshakeLimitedTickets = bridgeTickets.filter(
    (ticket) => ticket.brokerHandshakeStatus === "HANDSHAKE_LIMITED"
  ).length;

  const handshakeBlockedTickets = bridgeTickets.filter(
    (ticket) => ticket.brokerHandshakeStatus === "HANDSHAKE_BLOCKED"
  ).length;

  const totalBridgeCapitalUsd = bridgeTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalBridgePositionSizeUsd = round(
    bridgeTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalBridgeLotSize = round(
    bridgeTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const averageBridgeFillQuality = round(
    bridgeTickets.reduce((sum, ticket) => sum + ticket.estimatedFillQuality, 0) /
      bridgeTickets.length
  );

  const averageBridgeLatencyMs = round(
    bridgeTickets.reduce((sum, ticket) => sum + ticket.estimatedLatencyMs, 0) /
      bridgeTickets.length
  );

  const primaryBridgeSpecies =
    bridgeTickets.find((ticket) => ticket.bridgePriority === "CRITICAL")
      ?.species ?? "HYBRID";

  return {
    version: "V15.3.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_EXECUTION_QUEUE_INTEGRATION",
    target: "LIVE_EXECUTION_BRIDGE",
    symbol: "XAUUSD",
    totalSourceQueueTickets: sourceQueueTickets.length,
    totalBridgeTickets: bridgeTickets.length,
    liveReadyTickets,
    liveLimitedTickets,
    liveBlockedTickets,
    healthyBridgeTickets,
    degradedBridgeTickets,
    blockedBridgeTickets,
    handshakeReadyTickets,
    handshakeLimitedTickets,
    handshakeBlockedTickets,
    totalBridgeCapitalUsd,
    totalBridgePositionSizeUsd,
    totalBridgeLotSize,
    averageBridgeFillQuality,
    averageBridgeLatencyMs,
    primaryBridgeSpecies,
    bridgeTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Species Execution Queue tickets have been bridged into the live execution simulation layer.",
  };
}
