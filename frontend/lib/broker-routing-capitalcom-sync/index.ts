import type {
  BrokerRoutingCapitalComInput,
  BrokerRoutingCapitalComSyncItem,
  BrokerRoutingCapitalComSyncReport,
  CapitalComConnectorSnapshot,
} from "./broker-routing-capitalcom-types";

const connectorSnapshot: CapitalComConnectorSnapshot = {
  connectorMode: "READ_ONLY",
  accountMode: "DEMO",
  connectionStatus: "PREPARED",
  apiHealth: "HEALTHY",
  liveTradingEnabled: false,
  allowLiveOrders: false,
  maxLeverage: 200,
  leverageRiskMode: "CONTROLLED",
};

const brokerRoutes: BrokerRoutingCapitalComInput[] = [
  {
    id: "broker-route-nas100-swing",
    symbol: "NAS100",
    tradingStyle: "SWING",
    direction: "LONG",
    brokerRouteStatus: "ROUTED",
    preferredBroker: "PAPER_BROKER",
    fallbackBroker: "CAPITAL_COM",
    executionMode: "PAPER",
    executionPriority: 100,
    queuePosition: 1,
    finalPositionSize: 960,
    positionSizeMultiplier: 0.8,
  },
  {
    id: "broker-route-xauusd-scalping",
    symbol: "XAUUSD",
    tradingStyle: "SCALPING",
    direction: "LONG",
    brokerRouteStatus: "WAITING",
    preferredBroker: "NO_BROKER",
    fallbackBroker: "NO_BROKER",
    executionMode: "LIVE_BLOCKED",
    executionPriority: 93.8,
    queuePosition: 2,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
  },
  {
    id: "broker-route-spx500-none",
    symbol: "SPX500",
    tradingStyle: "NONE",
    direction: "NEUTRAL",
    brokerRouteStatus: "BLOCKED",
    preferredBroker: "NO_BROKER",
    fallbackBroker: "NO_BROKER",
    executionMode: "LIVE_BLOCKED",
    executionPriority: 0,
    queuePosition: 0,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
  },
];

function isCapitalComEligible(input: BrokerRoutingCapitalComInput) {
  return (
    input.preferredBroker === "CAPITAL_COM" ||
    input.fallbackBroker === "CAPITAL_COM" ||
    input.tradingStyle === "DAYTRADING" ||
    input.tradingStyle === "SWING"
  );
}

function calculateLeverageRiskMultiplier(input: BrokerRoutingCapitalComInput) {
  if (!isCapitalComEligible(input)) return 0;

  if (input.tradingStyle === "SCALPING") return 0.45;
  if (input.tradingStyle === "DAYTRADING") return 0.65;
  if (input.tradingStyle === "SWING") return 0.75;

  return 0;
}

function calculateAdjustedPositionSize(input: BrokerRoutingCapitalComInput) {
  const multiplier = calculateLeverageRiskMultiplier(input);

  if (input.finalPositionSize <= 0) return 0;

  return Number((input.finalPositionSize * multiplier).toFixed(2));
}

function buildSyncItem(input: BrokerRoutingCapitalComInput): BrokerRoutingCapitalComSyncItem {
  const capitalComEligible = isCapitalComEligible(input);
  const readOnlySafe = connectorSnapshot.connectorMode === "READ_ONLY";
  const liveExecutionBlocked =
    !connectorSnapshot.liveTradingEnabled || !connectorSnapshot.allowLiveOrders;

  const leverageRiskMultiplier = calculateLeverageRiskMultiplier(input);
  const capitalComAdjustedPositionSize = calculateAdjustedPositionSize(input);

  const capitalComRouteStatus =
    !capitalComEligible || input.brokerRouteStatus === "BLOCKED"
      ? "BLOCKED"
      : input.brokerRouteStatus === "WAITING" || input.executionMode === "LIVE_BLOCKED"
        ? "WAITING_FOR_APPROVAL"
        : "SYNCED";

  const reason =
    capitalComRouteStatus === "SYNCED"
      ? `${input.symbol}: Capital.com route prepared in read-only/demo safety mode with 1:200 leverage-adjusted position size.`
      : capitalComRouteStatus === "WAITING_FOR_APPROVAL"
        ? `${input.symbol}: Capital.com route waiting for approval or execution unlock. Live execution remains blocked.`
        : `${input.symbol}: Capital.com route blocked because route is not eligible or broker routing blocked it.`;

  return {
    id: `capitalcom-sync-${input.symbol.toLowerCase()}-${input.tradingStyle.toLowerCase()}`,
    sourceRouteId: input.id,
    symbol: input.symbol,
    tradingStyle: input.tradingStyle,
    direction: input.direction,
    capitalComRouteStatus,
    capitalComEligible,
    readOnlySafe,
    liveExecutionBlocked,
    originalPositionSize: input.finalPositionSize,
    capitalComAdjustedPositionSize,
    leverage: connectorSnapshot.maxLeverage,
    leverageRiskMultiplier,
    executionPriority: input.executionPriority,
    queuePosition: input.queuePosition,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function getBrokerRoutingCapitalComSyncReport(): BrokerRoutingCapitalComSyncReport {
  const items = brokerRoutes.map(buildSyncItem);

  const syncedRoutes = items.filter(
    (item) => item.capitalComRouteStatus === "SYNCED",
  ).length;

  const waitingRoutes = items.filter(
    (item) => item.capitalComRouteStatus === "WAITING_FOR_APPROVAL",
  ).length;

  const blockedRoutes = items.filter(
    (item) => item.capitalComRouteStatus === "BLOCKED",
  ).length;

  const recommendation =
    syncedRoutes > 0
      ? "Capital.com routes are prepared in demo/read-only mode. Live execution remains disabled."
      : waitingRoutes > 0
        ? "Capital.com sync has waiting routes. Keep read-only mode active and require confirmation before any live gateway unlock."
        : "No Capital.com routes are currently eligible.";

  return {
    version: "V12.0.5",
    status: "READY",
    mode: "SIMULATION",
    connector: connectorSnapshot,
    totalRoutes: items.length,
    syncedRoutes,
    waitingRoutes,
    blockedRoutes,
    liveExecutionEnabled: false,
    readOnlyMode: true,
    items,
    systemRule:
      "Broker Routing Capital.com Sync prepares Capital.com-specific route context with 1:200 leverage risk adjustment. Live execution remains disabled and connector stays read-only.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
