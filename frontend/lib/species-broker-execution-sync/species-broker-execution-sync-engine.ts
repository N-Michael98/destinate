import {
  BrokerExecutionPriority,
  BrokerExecutionSpecies,
  BrokerExecutionTarget,
  SpeciesBrokerExecutionSyncReport,
  SpeciesBrokerExecutionSyncTicket,
} from "./species-broker-execution-sync-types";

type SourceBridgeTicket = {
  bridgeTicketId: string;
  species: BrokerExecutionSpecies;
  bridgeStatus:
    | "LIVE_EXECUTION_READY"
    | "LIVE_EXECUTION_LIMITED"
    | "LIVE_EXECUTION_BLOCKED";
  liveExecutionReady: boolean;
  brokerHandshakeStatus:
    | "HANDSHAKE_READY"
    | "HANDSHAKE_LIMITED"
    | "HANDSHAKE_BLOCKED";
  executionBridgeHealth: "HEALTHY" | "DEGRADED" | "BLOCKED";
  bridgePriority: BrokerExecutionPriority;
  scheduledBroker: BrokerExecutionTarget;
  backupBroker: BrokerExecutionTarget;
  queuePosition: number;
  executionWindow: "IMMEDIATE" | "STANDARD" | "TACTICAL" | "BLOCKED";
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
};

const sourceBridgeTickets: SourceBridgeTicket[] = [
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-001",
    species: "HYBRID",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "CRITICAL",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    queuePosition: 1,
    executionWindow: "IMMEDIATE",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-002",
    species: "HYBRID",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "CRITICAL",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    queuePosition: 2,
    executionWindow: "IMMEDIATE",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-003",
    species: "HYBRID",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "CRITICAL",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    queuePosition: 3,
    executionWindow: "IMMEDIATE",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-004",
    species: "HYBRID",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "CRITICAL",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "CAPITAL_COM",
    queuePosition: 4,
    executionWindow: "IMMEDIATE",
    capitalUsd: 9750,
    positionSizeUsd: 6093.75,
    lotSize: 0.061,
    estimatedFillQuality: 97,
    estimatedLatencyMs: 84,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-005",
    species: "LIQUIDITY",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "HIGH",
    scheduledBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    queuePosition: 5,
    executionWindow: "STANDARD",
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    estimatedFillQuality: 90,
    estimatedLatencyMs: 92,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-006",
    species: "LIQUIDITY",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "HIGH",
    scheduledBroker: "CAPITAL_COM",
    backupBroker: "IC_MARKETS",
    queuePosition: 6,
    executionWindow: "STANDARD",
    capitalUsd: 9500,
    positionSizeUsd: 4222.22,
    lotSize: 0.042,
    estimatedFillQuality: 90,
    estimatedLatencyMs: 92,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-009",
    species: "INSTITUTIONAL",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "HIGH",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    queuePosition: 7,
    executionWindow: "STANDARD",
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    estimatedFillQuality: 95,
    estimatedLatencyMs: 84,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-010",
    species: "INSTITUTIONAL",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "HIGH",
    scheduledBroker: "DUAL_BROKER",
    backupBroker: "IC_MARKETS",
    queuePosition: 8,
    executionWindow: "STANDARD",
    capitalUsd: 9500,
    positionSizeUsd: 4750,
    lotSize: 0.048,
    estimatedFillQuality: 95,
    estimatedLatencyMs: 84,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-007",
    species: "TREND",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "MEDIUM",
    scheduledBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    queuePosition: 9,
    executionWindow: "STANDARD",
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    estimatedFillQuality: 88,
    estimatedLatencyMs: 71,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-008",
    species: "TREND",
    bridgeStatus: "LIVE_EXECUTION_READY",
    liveExecutionReady: true,
    brokerHandshakeStatus: "HANDSHAKE_READY",
    executionBridgeHealth: "HEALTHY",
    bridgePriority: "MEDIUM",
    scheduledBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    queuePosition: 10,
    executionWindow: "STANDARD",
    capitalUsd: 9500,
    positionSizeUsd: 4071.43,
    lotSize: 0.041,
    estimatedFillQuality: 88,
    estimatedLatencyMs: 71,
  },
  {
    bridgeTicketId: "BRIDGE-TICKET-SPECIES-011",
    species: "BREAKOUT",
    bridgeStatus: "LIVE_EXECUTION_LIMITED",
    liveExecutionReady: false,
    brokerHandshakeStatus: "HANDSHAKE_LIMITED",
    executionBridgeHealth: "DEGRADED",
    bridgePriority: "LOW",
    scheduledBroker: "IC_MARKETS",
    backupBroker: "CAPITAL_COM",
    queuePosition: 11,
    executionWindow: "TACTICAL",
    capitalUsd: 4000,
    positionSizeUsd: 555.56,
    lotSize: 0.006,
    estimatedFillQuality: 76,
    estimatedLatencyMs: 71,
  },
];

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getExecutionSyncStatus(
  bridgeStatus: SourceBridgeTicket["bridgeStatus"]
): SpeciesBrokerExecutionSyncTicket["executionSyncStatus"] {
  if (bridgeStatus === "LIVE_EXECUTION_READY") return "DISPATCH_READY";
  if (bridgeStatus === "LIVE_EXECUTION_LIMITED") return "DISPATCH_LIMITED";
  return "DISPATCH_BLOCKED";
}

function getBrokerConnectionStatus(
  handshakeStatus: SourceBridgeTicket["brokerHandshakeStatus"]
): SpeciesBrokerExecutionSyncTicket["brokerConnectionStatus"] {
  if (handshakeStatus === "HANDSHAKE_READY") return "CONNECTED";
  if (handshakeStatus === "HANDSHAKE_LIMITED") return "LIMITED_CONNECTION";
  return "NO_CONNECTION";
}

function getExecutionConfirmationStatus(
  bridgeStatus: SourceBridgeTicket["bridgeStatus"]
): SpeciesBrokerExecutionSyncTicket["executionConfirmationStatus"] {
  if (bridgeStatus === "LIVE_EXECUTION_READY") return "CONFIRMATION_PENDING";
  if (bridgeStatus === "LIVE_EXECUTION_LIMITED") return "LIMITED_CONFIRMATION";
  return "CONFIRMATION_BLOCKED";
}

function getExecutionSyncHealth(
  bridgeHealth: SourceBridgeTicket["executionBridgeHealth"]
): SpeciesBrokerExecutionSyncTicket["executionSyncHealth"] {
  if (bridgeHealth === "HEALTHY") return "HEALTHY";
  if (bridgeHealth === "DEGRADED") return "DEGRADED";
  return "BLOCKED";
}

function getBrokerExecutionRole(species: BrokerExecutionSpecies): string {
  const roles: Record<BrokerExecutionSpecies, string> = {
    HYBRID: "Critical Hybrid broker execution sync ticket prepared for dual-broker dispatch.",
    LIQUIDITY: "Liquidity-aware broker execution sync ticket prepared for Capital.com dispatch.",
    TREND: "Trend-following broker execution sync ticket prepared for IC Markets dispatch.",
    INSTITUTIONAL: "Institutional broker execution sync ticket prepared for dual-broker validation.",
    BREAKOUT: "Limited breakout broker execution sync ticket prepared with tactical restrictions.",
    MEAN_REVERSION: "Broker execution sync blocked until species allocation is restored.",
  };

  return roles[species];
}

export function getSpeciesBrokerExecutionSyncReport(): SpeciesBrokerExecutionSyncReport {
  const brokerExecutionTickets: SpeciesBrokerExecutionSyncTicket[] =
    sourceBridgeTickets.map((ticket) => ({
      sourceBridgeTicketId: ticket.bridgeTicketId,
      brokerExecutionTicketId: ticket.bridgeTicketId.replace(
        "BRIDGE-TICKET",
        "BROKER-EXECUTION-SYNC"
      ),
      species: ticket.species,
      symbol: "XAUUSD",
      side: "PENDING_SIGNAL",
      orderIntent: "SPECIES_EVOLUTION_EXECUTION",
      executionSyncStatus: getExecutionSyncStatus(ticket.bridgeStatus),
      targetBroker: ticket.scheduledBroker,
      backupBroker: ticket.backupBroker,
      brokerConnectionStatus: getBrokerConnectionStatus(
        ticket.brokerHandshakeStatus
      ),
      executionConfirmationStatus: getExecutionConfirmationStatus(
        ticket.bridgeStatus
      ),
      executionSyncHealth: getExecutionSyncHealth(ticket.executionBridgeHealth),
      executionDispatchReady: ticket.liveExecutionReady,
      brokerExecutionPriority: ticket.bridgePriority,
      queuePosition: ticket.queuePosition,
      executionWindow: ticket.executionWindow,
      capitalUsd: ticket.capitalUsd,
      positionSizeUsd: ticket.positionSizeUsd,
      lotSize: ticket.lotSize,
      estimatedFillQuality: ticket.estimatedFillQuality,
      estimatedLatencyMs: ticket.estimatedLatencyMs,
      brokerExecutionRole: getBrokerExecutionRole(ticket.species),
    }));

  const dispatchReadyTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionSyncStatus === "DISPATCH_READY"
  ).length;

  const dispatchLimitedTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionSyncStatus === "DISPATCH_LIMITED"
  ).length;

  const dispatchBlockedTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionSyncStatus === "DISPATCH_BLOCKED"
  ).length;

  const connectedBrokerTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.brokerConnectionStatus === "CONNECTED"
  ).length;

  const limitedConnectionTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.brokerConnectionStatus === "LIMITED_CONNECTION"
  ).length;

  const noConnectionTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.brokerConnectionStatus === "NO_CONNECTION"
  ).length;

  const confirmationPendingTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionConfirmationStatus === "CONFIRMATION_PENDING"
  ).length;

  const limitedConfirmationTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionConfirmationStatus === "LIMITED_CONFIRMATION"
  ).length;

  const confirmationBlockedTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionConfirmationStatus === "CONFIRMATION_BLOCKED"
  ).length;

  const healthySyncTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionSyncHealth === "HEALTHY"
  ).length;

  const degradedSyncTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionSyncHealth === "DEGRADED"
  ).length;

  const blockedSyncTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.executionSyncHealth === "BLOCKED"
  ).length;

  const capitalComExecutionTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.targetBroker === "CAPITAL_COM"
  ).length;

  const icMarketsExecutionTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.targetBroker === "IC_MARKETS"
  ).length;

  const dualBrokerExecutionTickets = brokerExecutionTickets.filter(
    (ticket) => ticket.targetBroker === "DUAL_BROKER"
  ).length;

  const totalBrokerExecutionCapitalUsd = brokerExecutionTickets.reduce(
    (sum, ticket) => sum + ticket.capitalUsd,
    0
  );

  const totalBrokerExecutionPositionSizeUsd = round(
    brokerExecutionTickets.reduce((sum, ticket) => sum + ticket.positionSizeUsd, 0)
  );

  const totalBrokerExecutionLotSize = round(
    brokerExecutionTickets.reduce((sum, ticket) => sum + ticket.lotSize, 0),
    3
  );

  const averageBrokerExecutionFillQuality = round(
    brokerExecutionTickets.reduce(
      (sum, ticket) => sum + ticket.estimatedFillQuality,
      0
    ) / brokerExecutionTickets.length
  );

  const averageBrokerExecutionLatencyMs = round(
    brokerExecutionTickets.reduce(
      (sum, ticket) => sum + ticket.estimatedLatencyMs,
      0
    ) / brokerExecutionTickets.length
  );

  const primaryBrokerExecutionSpecies =
    brokerExecutionTickets.find(
      (ticket) => ticket.brokerExecutionPriority === "CRITICAL"
    )?.species ?? "HYBRID";

  return {
    version: "V15.4.0",
    status: "READY",
    mode: "SIMULATION",
    source: "SPECIES_LIVE_EXECUTION_BRIDGE",
    target: "BROKER_EXECUTION_SYNC",
    symbol: "XAUUSD",
    totalSourceBridgeTickets: sourceBridgeTickets.length,
    totalBrokerExecutionTickets: brokerExecutionTickets.length,
    dispatchReadyTickets,
    dispatchLimitedTickets,
    dispatchBlockedTickets,
    connectedBrokerTickets,
    limitedConnectionTickets,
    noConnectionTickets,
    confirmationPendingTickets,
    limitedConfirmationTickets,
    confirmationBlockedTickets,
    healthySyncTickets,
    degradedSyncTickets,
    blockedSyncTickets,
    capitalComExecutionTickets,
    icMarketsExecutionTickets,
    dualBrokerExecutionTickets,
    totalBrokerExecutionCapitalUsd,
    totalBrokerExecutionPositionSizeUsd,
    totalBrokerExecutionLotSize,
    averageBrokerExecutionFillQuality,
    averageBrokerExecutionLatencyMs,
    primaryBrokerExecutionSpecies,
    brokerExecutionTickets,
    blockedSpecies: ["MEAN_REVERSION"],
    summary:
      "Species Live Execution Bridge tickets have been synchronized into broker execution dispatch-ready tickets.",
  };
}
