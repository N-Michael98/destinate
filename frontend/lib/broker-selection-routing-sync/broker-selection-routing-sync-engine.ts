import { generatePortfolioBrainBrokerSelectionSyncReport } from "@/lib/portfolio-brain-broker-selection-sync";

import {
  BrokerSelectionRoutingDecision,
  BrokerSelectionRoutingSyncReport,
} from "./broker-selection-routing-sync-types";

const VERSION = "V16.1.6" as const;

function normalizeStyle(style: string): BrokerSelectionRoutingDecision["tradingStyle"] {
  if (style === "SCALPING" || style === "DAYTRADING" || style === "SWING") {
    return style;
  }

  return "NONE";
}

function resolveRouteStatus(params: {
  brokerRoutingMode: string;
  approvalRequired: boolean;
}): BrokerSelectionRoutingDecision["brokerRouteStatus"] {
  if (params.brokerRoutingMode === "NO_BROKER_ROUTE") return "BLOCKED";
  if (params.approvalRequired) return "WAITING";
  return "ROUTED";
}

function resolveExecutionMode(
  status: BrokerSelectionRoutingDecision["brokerRouteStatus"]
): BrokerSelectionRoutingDecision["executionMode"] {
  if (status === "ROUTED") return "PAPER";
  if (status === "WAITING") return "LIVE_BLOCKED";
  return "LIVE_BLOCKED";
}

function resolveDirection(symbol: string): BrokerSelectionRoutingDecision["direction"] {
  if (symbol === "NONE") return "NEUTRAL";
  return "LONG";
}

function resolvePositionSizeMultiplier(finalPositionSize: number) {
  if (finalPositionSize <= 0) return 0;
  if (finalPositionSize >= 750) return 0.8;
  if (finalPositionSize >= 300) return 0.5;
  return 0.3;
}

function buildDecision(): BrokerSelectionRoutingDecision {
  const brokerSelection = generatePortfolioBrainBrokerSelectionSyncReport();
  const decision = brokerSelection.bestDecision ?? brokerSelection.decisions[0];

  if (!decision) {
    return {
      id: "broker-selection-routing-none",
      symbol: "NONE",
      tradingStyle: "NONE",
      direction: "NEUTRAL",
      brokerRoutingMode: "NO_BROKER_ROUTE",
      preferredBroker: "NO_BROKER",
      fallbackBroker: "NO_BROKER",
      brokerRouteStatus: "BLOCKED",
      executionMode: "LIVE_BLOCKED",
      executionPriority: 0,
      queuePosition: 0,
      finalPositionSize: 0,
      positionSizeMultiplier: 0,
      capitalComAllocation: 0,
      icMarketsAllocation: 0,
      allowExecution: false,
      requireStrictApproval: false,
      portfolioBrainRoute: "NO_TRADE_ROUTE",
      reason: "No Portfolio Brain Broker Selection decision available.",
    };
  }

  const brokerRouteStatus = resolveRouteStatus({
    brokerRoutingMode: decision.brokerRoutingMode,
    approvalRequired: decision.approvalRequired,
  });

  const allowExecution = brokerRouteStatus === "ROUTED";

  return {
    id: `broker-selection-routing-${decision.symbol.toLowerCase()}`,
    symbol: decision.symbol,
    tradingStyle: normalizeStyle(decision.primaryStyle),
    direction: resolveDirection(decision.symbol),
    brokerRoutingMode: decision.brokerRoutingMode,
    preferredBroker: decision.primaryBroker,
    fallbackBroker: decision.secondaryBroker,
    brokerRouteStatus,
    executionMode: resolveExecutionMode(brokerRouteStatus),
    executionPriority: decision.executionPriority,
    queuePosition: 1,
    finalPositionSize: allowExecution ? decision.finalPositionSize : 0,
    positionSizeMultiplier: allowExecution
      ? resolvePositionSizeMultiplier(decision.finalPositionSize)
      : 0,
    capitalComAllocation: allowExecution ? decision.capitalComAllocation : 0,
    icMarketsAllocation: allowExecution ? decision.icMarketsAllocation : 0,
    allowExecution,
    requireStrictApproval: decision.approvalRequired,
    portfolioBrainRoute: decision.brokerRoutingMode,
    reason:
      brokerRouteStatus === "ROUTED"
        ? `${decision.symbol}: Broker Selection routed to ${decision.primaryBroker} with fallback ${decision.secondaryBroker}.`
        : brokerRouteStatus === "WAITING"
          ? `${decision.symbol}: Broker Selection waiting for strict approval before routing.`
          : `${decision.symbol}: Broker Selection blocked. No broker route allowed.`,
  };
}

export function generateBrokerSelectionRoutingSyncReport():
  BrokerSelectionRoutingSyncReport {
  const decisions = [buildDecision()];

  const routedRoutes = decisions.filter(
    (decision) => decision.brokerRouteStatus === "ROUTED"
  ).length;

  const waitingRoutes = decisions.filter(
    (decision) => decision.brokerRouteStatus === "WAITING"
  ).length;

  const blockedRoutes = decisions.filter(
    (decision) => decision.brokerRouteStatus === "BLOCKED"
  ).length;

  const icMarketsRoutes = decisions.filter(
    (decision) => decision.preferredBroker === "IC_MARKETS"
  ).length;

  const capitalComRoutes = decisions.filter(
    (decision) => decision.preferredBroker === "CAPITAL_COM"
  ).length;

  const dualBrokerRoutes = decisions.filter(
    (decision) =>
      decision.brokerRoutingMode === "DUAL_BROKER_CHECK" ||
      decision.brokerRoutingMode === "DUAL_BROKER_PRIORITY"
  ).length;

  const recommendation =
    routedRoutes > 0
      ? "Broker Selection Routing Sync has routed Portfolio Brain broker decisions in paper/simulation mode."
      : waitingRoutes > 0
        ? "Broker Selection Routing Sync is waiting for strict approval."
        : "Broker Selection Routing Sync blocks broker routing.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalRoutes: decisions.length,
    routedRoutes,
    waitingRoutes,
    blockedRoutes,
    icMarketsRoutes,
    capitalComRoutes,
    dualBrokerRoutes,
    liveExecutionEnabled: false,
    decisions,
    systemRule:
      "Broker Selection Routing Sync converts Portfolio Brain Broker Selection into broker routing decisions while live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
