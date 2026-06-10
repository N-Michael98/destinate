import { generateBrokerSelectionRoutingSyncReport } from "@/lib/broker-selection-routing-sync";

import {
  BrokerAllocation,
  BrokerRoutingDualBrokerDecision,
  BrokerRoutingDualBrokerSyncReport,
  DualBrokerSyncMode,
} from "./broker-routing-dual-broker-sync-types";

const VERSION = "V16.1.7" as const;

function resolveMode(route: ReturnType<typeof generateBrokerSelectionRoutingSyncReport>["decisions"][number]): DualBrokerSyncMode {
  if (route.brokerRouteStatus === "BLOCKED") return "BLOCKED";
  if (route.brokerRouteStatus === "WAITING") return "WAITING";

  if (
    route.brokerRoutingMode === "DUAL_BROKER_CHECK" ||
    route.brokerRoutingMode === "DUAL_BROKER_PRIORITY"
  ) {
    return "DUAL_BROKER_READY";
  }

  return "SINGLE_BROKER_READY";
}

function resolveFinalStatus(mode: DualBrokerSyncMode) {
  if (mode === "DUAL_BROKER_READY" || mode === "SINGLE_BROKER_READY") {
    return "APPROVED" as const;
  }

  if (mode === "WAITING") return "WAITING" as const;

  return "BLOCKED" as const;
}

function buildBrokerAllocation(params: {
  broker: "IC_MARKETS" | "CAPITAL_COM";
  route: ReturnType<typeof generateBrokerSelectionRoutingSyncReport>["decisions"][number];
  mode: DualBrokerSyncMode;
}): BrokerAllocation {
  const allocationPercent =
    params.broker === "IC_MARKETS"
      ? params.route.icMarketsAllocation
      : params.route.capitalComAllocation;

  const eligible =
    params.mode !== "BLOCKED" &&
    params.mode !== "WAITING" &&
    allocationPercent > 0;

  const leverage = params.broker === "IC_MARKETS" ? 500 : 200;

  const leverageRiskMultiplier =
    params.broker === "IC_MARKETS"
      ? params.route.tradingStyle === "SCALPING"
        ? 0.35
        : params.route.tradingStyle === "DAYTRADING"
          ? 0.45
          : 0.25
      : params.route.tradingStyle === "SCALPING"
        ? 0.45
        : params.route.tradingStyle === "DAYTRADING"
          ? 0.65
          : 0.75;

  const routeStatus =
    !eligible
      ? params.mode === "WAITING"
        ? "WAITING_FOR_APPROVAL"
        : "BLOCKED"
      : "SYNCED";

  const allocatedPositionSize =
    routeStatus === "SYNCED"
      ? Number(
          (
            params.route.finalPositionSize *
            (allocationPercent / 100) *
            leverageRiskMultiplier
          ).toFixed(2)
        )
      : 0;

  return {
    broker: params.broker,
    eligible,
    allocationPercent: eligible ? allocationPercent : 0,
    allocatedPositionSize,
    routeStatus,
    leverage,
    leverageRiskMultiplier: eligible ? leverageRiskMultiplier : 0,
    reason:
      routeStatus === "SYNCED"
        ? `${params.broker}: synced with ${allocationPercent}% allocation and leverage-risk multiplier ${leverageRiskMultiplier}.`
        : routeStatus === "WAITING_FOR_APPROVAL"
          ? `${params.broker}: waiting for approval before broker orchestration.`
          : `${params.broker}: blocked or not eligible for this broker route.`,
  };
}

function buildDecision(
  route: ReturnType<typeof generateBrokerSelectionRoutingSyncReport>["decisions"][number]
): BrokerRoutingDualBrokerDecision {
  const dualBrokerMode = resolveMode(route);

  const allocations = [
    buildBrokerAllocation({
      broker: "IC_MARKETS",
      route,
      mode: dualBrokerMode,
    }),
    buildBrokerAllocation({
      broker: "CAPITAL_COM",
      route,
      mode: dualBrokerMode,
    }),
  ];

  const totalAllocatedPositionSize = Number(
    allocations
      .reduce((sum, allocation) => sum + allocation.allocatedPositionSize, 0)
      .toFixed(2)
  );

  const finalDecisionStatus = resolveFinalStatus(dualBrokerMode);

  return {
    id: `broker-routing-dual-broker-${route.symbol.toLowerCase()}`,
    symbol: route.symbol,
    tradingStyle: route.tradingStyle,
    direction: route.direction,
    dualBrokerMode,
    preferredBroker: route.preferredBroker,
    secondaryBroker: route.fallbackBroker,
    useDualBrokerExecution: dualBrokerMode === "DUAL_BROKER_READY",
    finalDecisionStatus,
    totalAllocatedPositionSize,
    originalPositionSize: route.finalPositionSize,
    executionPriority: route.executionPriority,
    readOnlySafe: true,
    liveExecutionBlocked: true,
    allocations,
    reason:
      dualBrokerMode === "DUAL_BROKER_READY"
        ? `${route.symbol}: Dual Broker Orchestrator prepared both broker routes from V16 broker routing sync.`
        : dualBrokerMode === "SINGLE_BROKER_READY"
          ? `${route.symbol}: Single broker route prepared from V16 broker routing sync.`
          : dualBrokerMode === "WAITING"
            ? `${route.symbol}: Dual Broker Orchestrator waiting for strict approval.`
            : `${route.symbol}: Dual Broker Orchestrator blocked because no broker route is allowed.`,
  };
}

export function generateBrokerRoutingDualBrokerSyncReport():
  BrokerRoutingDualBrokerSyncReport {
  const routing = generateBrokerSelectionRoutingSyncReport();

  const decisions = routing.decisions.map(buildDecision);

  const dualBrokerReadySymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "DUAL_BROKER_READY"
  ).length;

  const singleBrokerReadySymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "SINGLE_BROKER_READY"
  ).length;

  const waitingSymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "WAITING"
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "BLOCKED"
  ).length;

  const recommendation =
    dualBrokerReadySymbols > 0
      ? "Dual broker orchestration is ready in read-only simulation mode. Keep live execution disabled."
      : singleBrokerReadySymbols > 0
        ? "Single broker orchestration is ready in simulation mode."
        : waitingSymbols > 0
          ? "Dual broker orchestration is waiting for strict approval."
          : "Dual broker orchestration blocks execution.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    dualBrokerReadySymbols,
    singleBrokerReadySymbols,
    waitingSymbols,
    blockedSymbols,
    liveExecutionEnabled: false,
    readOnlyMode: true,
    decisions,
    systemRule:
      "Broker Routing Dual Broker Sync converts V16 Broker Selection Routing decisions into dual-broker orchestration while live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
