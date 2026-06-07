import type {
  BrokerRoutingICMarketsInput,
  BrokerRoutingICMarketsSyncItem,
  BrokerRoutingICMarketsSyncReport,
  ICMarketsConnectorSnapshot,
} from "./broker-routing-icmarkets-types";

const connectorSnapshot: ICMarketsConnectorSnapshot = {
  connectorMode: "READ_ONLY",
  accountMode: "DEMO",
  connectionStatus: "PREPARED",
  apiHealth: "HEALTHY",
  liveTradingEnabled: false,
  allowLiveOrders: false,
  maxLeverage: 500,
  leverageRiskMode: "STRICT",
};

const brokerRoutes: BrokerRoutingICMarketsInput[] = [
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

function isICMarketsEligible(input: BrokerRoutingICMarketsInput) {
  return (
    input.preferredBroker === "IC_MARKETS" ||
    input.fallbackBroker === "IC_MARKETS" ||
    input.tradingStyle === "SCALPING"
  );
}

function calculateLeverageRiskMultiplier(input: BrokerRoutingICMarketsInput) {
  if (!isICMarketsEligible(input)) return 0;

  if (input.tradingStyle === "SCALPING") return 0.35;
  if (input.tradingStyle === "DAYTRADING") return 0.45;
  if (input.tradingStyle === "SWING") return 0.25;

  return 0;
}

function calculateAdjustedPositionSize(input: BrokerRoutingICMarketsInput) {
  const multiplier = calculateLeverageRiskMultiplier(input);

  if (input.finalPositionSize <= 0) return 0;

  return Number((input.finalPositionSize * multiplier).toFixed(2));
}

function buildSyncItem(input: BrokerRoutingICMarketsInput): BrokerRoutingICMarketsSyncItem {
  const icMarketsEligible = isICMarketsEligible(input);
  const readOnlySafe = connectorSnapshot.connectorMode === "READ_ONLY";
  const liveExecutionBlocked =
    !connectorSnapshot.liveTradingEnabled || !connectorSnapshot.allowLiveOrders;

  const leverageRiskMultiplier = calculateLeverageRiskMultiplier(input);
  const icMarketsAdjustedPositionSize = calculateAdjustedPositionSize(input);

  const icMarketsRouteStatus =
    !icMarketsEligible || input.brokerRouteStatus === "BLOCKED"
      ? "BLOCKED"
      : input.brokerRouteStatus === "WAITING" || input.executionMode === "LIVE_BLOCKED"
        ? "WAITING_FOR_APPROVAL"
        : "SYNCED";

  const reason =
    icMarketsRouteStatus === "SYNCED"
      ? `${input.symbol}: IC Markets route prepared in read-only/demo safety mode with leverage-adjusted position size.`
      : icMarketsRouteStatus === "WAITING_FOR_APPROVAL"
        ? `${input.symbol}: IC Markets route waiting for strict approval or execution unlock. Live execution remains blocked.`
        : `${input.symbol}: IC Markets route blocked because route is not eligible or broker routing blocked it.`;

  return {
    id: `icmarkets-sync-${input.symbol.toLowerCase()}-${input.tradingStyle.toLowerCase()}`,
    sourceRouteId: input.id,
    symbol: input.symbol,
    tradingStyle: input.tradingStyle,
    direction: input.direction,
    icMarketsRouteStatus,
    icMarketsEligible,
    readOnlySafe,
    liveExecutionBlocked,
    originalPositionSize: input.finalPositionSize,
    icMarketsAdjustedPositionSize,
    leverage: connectorSnapshot.maxLeverage,
    leverageRiskMultiplier,
    executionPriority: input.executionPriority,
    queuePosition: input.queuePosition,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function getBrokerRoutingICMarketsSyncReport(): BrokerRoutingICMarketsSyncReport {
  const items = brokerRoutes.map(buildSyncItem);

  const syncedRoutes = items.filter(
    (item) => item.icMarketsRouteStatus === "SYNCED",
  ).length;

  const waitingRoutes = items.filter(
    (item) => item.icMarketsRouteStatus === "WAITING_FOR_APPROVAL",
  ).length;

  const blockedRoutes = items.filter(
    (item) => item.icMarketsRouteStatus === "BLOCKED",
  ).length;

  const recommendation =
    waitingRoutes > 0
      ? "IC Markets sync has waiting routes. Keep read-only mode active and require strict approval before any future live gateway unlock."
      : syncedRoutes > 0
        ? "IC Markets routes are prepared in demo/read-only mode. Live execution remains disabled."
        : "No IC Markets routes are currently eligible.";

  return {
    version: "V12.0.4",
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
      "Broker Routing IC Markets Sync prepares IC Markets-specific route context with 1:500 leverage risk adjustment. Live execution remains disabled and connector stays read-only.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
