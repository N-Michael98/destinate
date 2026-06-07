import type {
  BrokerName,
  BrokerRoute,
  BrokerRoutingInput,
  BrokerRoutingLayerReport,
} from "./broker-routing-types";

const schedulerInputs: BrokerRoutingInput[] = [
  {
    id: "ai-scheduler-nas100-swing",
    symbol: "NAS100",
    tradingStyle: "SWING",
    direction: "LONG",
    schedulerStatus: "SCHEDULED",
    executionUrgency: "IMMEDIATE",
    executionPriority: 100,
    queuePosition: 1,
    allowExecution: true,
    requireStrictApproval: false,
    positionSizeMultiplier: 0.8,
    finalPositionSize: 960,
    portfolioBrainRoute: "SWING_ROUTE",
  },
  {
    id: "ai-scheduler-xauusd-scalping",
    symbol: "XAUUSD",
    tradingStyle: "SCALPING",
    direction: "LONG",
    schedulerStatus: "WAITING",
    executionUrgency: "HIGH",
    executionPriority: 93.8,
    queuePosition: 2,
    allowExecution: false,
    requireStrictApproval: true,
    positionSizeMultiplier: 0.35,
    finalPositionSize: 350,
    portfolioBrainRoute: "SCALP_ROUTE",
  },
  {
    id: "ai-scheduler-spx500-none",
    symbol: "SPX500",
    tradingStyle: "NONE",
    direction: "NEUTRAL",
    schedulerStatus: "BLOCKED",
    executionUrgency: "NONE",
    executionPriority: 0,
    queuePosition: 0,
    allowExecution: false,
    requireStrictApproval: false,
    positionSizeMultiplier: 0,
    finalPositionSize: 0,
    portfolioBrainRoute: "NO_TRADE_ROUTE",
  },
];

function resolvePreferredBroker(input: BrokerRoutingInput): BrokerName {
  if (input.schedulerStatus === "BLOCKED" || !input.allowExecution) {
    return "NO_BROKER";
  }

  if (input.tradingStyle === "SCALPING") {
    return "IC_MARKETS";
  }

  if (input.tradingStyle === "DAYTRADING") {
    return "CAPITAL_COM";
  }

  if (input.tradingStyle === "SWING") {
    return "PAPER_BROKER";
  }

  return "NO_BROKER";
}

function resolveFallbackBroker(input: BrokerRoutingInput): BrokerName {
  if (input.schedulerStatus === "BLOCKED" || !input.allowExecution) {
    return "NO_BROKER";
  }

  if (input.tradingStyle === "SCALPING") {
    return "PAPER_BROKER";
  }

  if (input.tradingStyle === "DAYTRADING") {
    return "PAPER_BROKER";
  }

  if (input.tradingStyle === "SWING") {
    return "CAPITAL_COM";
  }

  return "NO_BROKER";
}

function buildRoute(input: BrokerRoutingInput): BrokerRoute {
  const preferredBroker = resolvePreferredBroker(input);
  const fallbackBroker = resolveFallbackBroker(input);

  const brokerRouteStatus =
    input.schedulerStatus === "SCHEDULED" && input.allowExecution
      ? "ROUTED"
      : input.schedulerStatus === "WAITING"
        ? "WAITING"
        : "BLOCKED";

  const executionMode =
    brokerRouteStatus === "ROUTED"
      ? "PAPER"
      : brokerRouteStatus === "WAITING"
        ? "LIVE_BLOCKED"
        : "LIVE_BLOCKED";

  const routeReason =
    brokerRouteStatus === "ROUTED"
      ? `${input.symbol}: Routed to ${preferredBroker} in ${executionMode} mode.`
      : brokerRouteStatus === "WAITING"
        ? `${input.symbol}: Broker route waiting because Scheduler requires strict approval or execution is not allowed yet.`
        : `${input.symbol}: Broker route blocked because Scheduler blocked execution.`;

  const safetyRule =
    executionMode === "PAPER"
      ? "Paper/simulation only. No live broker order is sent."
      : "Live broker execution blocked until explicit live trading mode is enabled.";

  return {
    id: `broker-route-${input.symbol.toLowerCase()}-${input.tradingStyle.toLowerCase()}`,
    sourceSchedulerId: input.id,
    symbol: input.symbol,
    tradingStyle: input.tradingStyle,
    direction: input.direction,
    preferredBroker,
    fallbackBroker,
    brokerRouteStatus,
    executionMode,
    executionPriority: input.executionPriority,
    queuePosition: input.queuePosition,
    finalPositionSize: brokerRouteStatus === "ROUTED" ? input.finalPositionSize : 0,
    positionSizeMultiplier: brokerRouteStatus === "ROUTED" ? input.positionSizeMultiplier : 0,
    routeReason,
    safetyRule,
    createdAt: new Date().toISOString(),
  };
}

export function getBrokerRoutingLayerReport(): BrokerRoutingLayerReport {
  const routes = schedulerInputs.map(buildRoute);

  const routedItems = routes.filter(
    (route) => route.brokerRouteStatus === "ROUTED",
  ).length;

  const waitingItems = routes.filter(
    (route) => route.brokerRouteStatus === "WAITING",
  ).length;

  const blockedItems = routes.filter(
    (route) => route.brokerRouteStatus === "BLOCKED",
  ).length;

  const paperBrokerRoutes = routes.filter(
    (route) => route.preferredBroker === "PAPER_BROKER",
  ).length;

  const icMarketsRoutes = routes.filter(
    (route) => route.preferredBroker === "IC_MARKETS",
  ).length;

  const capitalComRoutes = routes.filter(
    (route) => route.preferredBroker === "CAPITAL_COM",
  ).length;

  const recommendation =
    routedItems > 0
      ? "Broker Routing Layer has routed paper/simulation orders. Keep live execution disabled until broker credentials, risk controls and manual live switch are implemented."
      : waitingItems > 0
        ? "Broker Routing Layer is waiting for strict approval before routing any execution."
        : "Broker Routing Layer blocks all execution.";

  return {
    version: "V12.0.2",
    status: "READY",
    mode: "SIMULATION",
    totalSchedulerItems: schedulerInputs.length,
    routedItems,
    waitingItems,
    blockedItems,
    paperBrokerRoutes,
    icMarketsRoutes,
    capitalComRoutes,
    liveExecutionEnabled: false,
    routes,
    systemRule:
      "Broker Routing Layer maps scheduled AI execution items to preferred broker routes. Live execution is disabled by default and all routed orders stay in paper/simulation mode until explicitly enabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
