import type {
  BrokerHealthDualBrokerDecision,
  BrokerHealthDualBrokerSyncReport,
  BrokerHealthInput,
  BrokerName,
  DualBrokerInput,
  DualBrokerMode,
  HealthWeightedBrokerAllocation,
} from "./broker-health-dual-broker-types";

const brokerHealthInputs: BrokerHealthInput[] = [
  {
    broker: "IC_MARKETS",
    apiHealth: "HEALTHY",
    brokerScore: 89,
    riskScore: 45,
    leverage: 500,
    averageLatencyMs: 95,
    currentSpreadPoints: 1.2,
    canRouteOrders: true,
    shouldReduceSize: true,
    shouldBlockNewOrders: false,
  },
  {
    broker: "CAPITAL_COM",
    apiHealth: "HEALTHY",
    brokerScore: 80,
    riskScore: 42,
    leverage: 200,
    averageLatencyMs: 140,
    currentSpreadPoints: 1.8,
    canRouteOrders: true,
    shouldReduceSize: false,
    shouldBlockNewOrders: false,
  },
];

const dualBrokerInputs: DualBrokerInput[] = [
  {
    symbol: "NAS100",
    tradingStyle: "SWING",
    direction: "LONG",
    broker: "IC_MARKETS",
    brokerDecisionStatus: "BLOCKED",
    eligible: false,
    leverageRiskMultiplier: 0,
    allocationPercent: 0,
    allocatedPositionSize: 0,
    executionPriority: 100,
  },
  {
    symbol: "NAS100",
    tradingStyle: "SWING",
    direction: "LONG",
    broker: "CAPITAL_COM",
    brokerDecisionStatus: "APPROVED",
    eligible: true,
    leverageRiskMultiplier: 0.75,
    allocationPercent: 100,
    allocatedPositionSize: 720,
    executionPriority: 100,
  },
  {
    symbol: "XAUUSD",
    tradingStyle: "SCALPING",
    direction: "LONG",
    broker: "IC_MARKETS",
    brokerDecisionStatus: "WAITING",
    eligible: true,
    leverageRiskMultiplier: 0.35,
    allocationPercent: 0,
    allocatedPositionSize: 0,
    executionPriority: 93.8,
  },
  {
    symbol: "XAUUSD",
    tradingStyle: "SCALPING",
    direction: "LONG",
    broker: "CAPITAL_COM",
    brokerDecisionStatus: "BLOCKED",
    eligible: false,
    leverageRiskMultiplier: 0,
    allocationPercent: 0,
    allocatedPositionSize: 0,
    executionPriority: 93.8,
  },
  {
    symbol: "SPX500",
    tradingStyle: "NONE",
    direction: "NEUTRAL",
    broker: "IC_MARKETS",
    brokerDecisionStatus: "BLOCKED",
    eligible: false,
    leverageRiskMultiplier: 0,
    allocationPercent: 0,
    allocatedPositionSize: 0,
    executionPriority: 0,
  },
  {
    symbol: "SPX500",
    tradingStyle: "NONE",
    direction: "NEUTRAL",
    broker: "CAPITAL_COM",
    brokerDecisionStatus: "BLOCKED",
    eligible: false,
    leverageRiskMultiplier: 0,
    allocationPercent: 0,
    allocatedPositionSize: 0,
    executionPriority: 0,
  },
];

function groupBySymbol(inputs: DualBrokerInput[]) {
  return inputs.reduce<Record<string, DualBrokerInput[]>>((groups, input) => {
    if (!groups[input.symbol]) {
      groups[input.symbol] = [];
    }

    groups[input.symbol].push(input);
    return groups;
  }, {});
}

function getBrokerHealth(broker: BrokerName) {
  return brokerHealthInputs.find((health) => health.broker === broker);
}

function calculateHealthAllocationMultiplier(health: BrokerHealthInput | undefined) {
  if (!health) return 0;
  if (health.shouldBlockNewOrders || !health.canRouteOrders || health.apiHealth === "CRITICAL") return 0;

  const brokerScoreMultiplier = health.brokerScore / 100;
  const riskMultiplier = Math.max(0.2, (100 - health.riskScore) / 100);
  const leveragePenalty = health.leverage >= 500 ? 0.75 : 1;
  const reduceSizePenalty = health.shouldReduceSize ? 0.75 : 1;

  return Number(
    Math.max(
      0,
      Math.min(1, brokerScoreMultiplier * riskMultiplier * leveragePenalty * reduceSizePenalty),
    ).toFixed(4),
  );
}

function buildHealthWeightedAllocation(input: DualBrokerInput): HealthWeightedBrokerAllocation {
  const health = getBrokerHealth(input.broker);
  const healthMultiplier = calculateHealthAllocationMultiplier(health);

  const active =
    input.brokerDecisionStatus === "APPROVED" &&
    input.eligible &&
    healthMultiplier > 0;

  const healthWeightedPositionSize = active
    ? Number((input.allocatedPositionSize * healthMultiplier).toFixed(2))
    : 0;

  const healthWeightedAllocationPercent = active
    ? Number((input.allocationPercent * healthMultiplier).toFixed(2))
    : 0;

  const healthStatus = health?.apiHealth ?? "UNKNOWN";

  const reason =
    !health
      ? `${input.broker}: no broker health data found. Allocation blocked.`
      : input.brokerDecisionStatus === "WAITING"
        ? `${input.broker}: route is waiting. Health data is available but allocation stays inactive.`
        : input.brokerDecisionStatus === "BLOCKED"
          ? `${input.broker}: route is blocked. Health weighting cannot activate it.`
          : health.shouldBlockNewOrders
            ? `${input.broker}: broker health blocks new orders.`
            : `${input.broker}: allocation health-weighted by broker score ${health.brokerScore}, risk score ${health.riskScore}, leverage ${health.leverage}.`;

  return {
    broker: input.broker,
    brokerDecisionStatus: input.brokerDecisionStatus,
    healthStatus,
    brokerScore: health?.brokerScore ?? 0,
    riskScore: health?.riskScore ?? 100,
    originalAllocationPercent: input.allocationPercent,
    healthWeightedAllocationPercent,
    originalPositionSize: input.allocatedPositionSize,
    healthWeightedPositionSize,
    shouldReduceSize: health?.shouldReduceSize ?? true,
    shouldBlockNewOrders: health?.shouldBlockNewOrders ?? true,
    reason,
  };
}

function resolveMode(allocations: HealthWeightedBrokerAllocation[]): DualBrokerMode {
  const approved = allocations.filter(
    (allocation) =>
      allocation.brokerDecisionStatus === "APPROVED" &&
      allocation.healthWeightedPositionSize > 0,
  );

  const waiting = allocations.filter(
    (allocation) => allocation.brokerDecisionStatus === "WAITING",
  );

  if (approved.length >= 2) return "HEALTH_WEIGHTED_DUAL_READY";
  if (approved.length === 1) return "HEALTH_WEIGHTED_SINGLE_READY";
  if (waiting.length > 0) return "WAITING";
  return "BLOCKED";
}

function resolvePreferredBroker(allocations: HealthWeightedBrokerAllocation[]): BrokerName {
  const active = allocations
    .filter((allocation) => allocation.healthWeightedPositionSize > 0)
    .sort((a, b) => b.healthWeightedPositionSize - a.healthWeightedPositionSize);

  return active[0]?.broker ?? "NO_BROKER";
}

function resolveSecondaryBroker(allocations: HealthWeightedBrokerAllocation[]): BrokerName {
  const active = allocations
    .filter((allocation) => allocation.healthWeightedPositionSize > 0)
    .sort((a, b) => b.healthWeightedPositionSize - a.healthWeightedPositionSize);

  return active[1]?.broker ?? "NO_BROKER";
}

function buildDecision(
  symbol: string,
  inputs: DualBrokerInput[],
): BrokerHealthDualBrokerDecision {
  const allocations = inputs.map(buildHealthWeightedAllocation);
  const dualBrokerMode = resolveMode(allocations);

  const totalOriginalPositionSize = Number(
    allocations.reduce((sum, allocation) => sum + allocation.originalPositionSize, 0).toFixed(2),
  );

  const totalHealthWeightedPositionSize = Number(
    allocations
      .reduce((sum, allocation) => sum + allocation.healthWeightedPositionSize, 0)
      .toFixed(2),
  );

  const firstInput = inputs[0];

  const finalDecisionStatus =
    dualBrokerMode === "HEALTH_WEIGHTED_DUAL_READY" ||
    dualBrokerMode === "HEALTH_WEIGHTED_SINGLE_READY"
      ? "APPROVED"
      : dualBrokerMode === "WAITING"
        ? "WAITING"
        : "BLOCKED";

  const preferredBroker = resolvePreferredBroker(allocations);
  const secondaryBroker = resolveSecondaryBroker(allocations);

  const reason =
    dualBrokerMode === "HEALTH_WEIGHTED_DUAL_READY"
      ? `${symbol}: both brokers passed broker health weighting. Dual broker allocation is prepared.`
      : dualBrokerMode === "HEALTH_WEIGHTED_SINGLE_READY"
        ? `${symbol}: one broker passed broker health weighting. Single broker health-weighted allocation is prepared.`
        : dualBrokerMode === "WAITING"
          ? `${symbol}: broker route is waiting. Health data is ready but execution remains paused.`
          : `${symbol}: no broker passed route and health checks. Execution remains blocked.`;

  return {
    id: `broker-health-dual-${symbol.toLowerCase()}`,
    symbol,
    tradingStyle: firstInput.tradingStyle,
    direction: firstInput.direction,
    dualBrokerMode,
    finalDecisionStatus,
    preferredBroker,
    secondaryBroker,
    totalOriginalPositionSize,
    totalHealthWeightedPositionSize,
    useDualBrokerExecution: dualBrokerMode === "HEALTH_WEIGHTED_DUAL_READY",
    allocations,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function getBrokerHealthDualBrokerSyncReport(): BrokerHealthDualBrokerSyncReport {
  const groupedInputs = groupBySymbol(dualBrokerInputs);

  const decisions = Object.entries(groupedInputs).map(([symbol, inputs]) =>
    buildDecision(symbol, inputs),
  );

  const healthWeightedDualReadySymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "HEALTH_WEIGHTED_DUAL_READY",
  ).length;

  const healthWeightedSingleReadySymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "HEALTH_WEIGHTED_SINGLE_READY",
  ).length;

  const waitingSymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "WAITING",
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "BLOCKED",
  ).length;

  const recommendation =
    healthWeightedDualReadySymbols > 0
      ? "Dual broker health-weighted execution is prepared in simulation mode. Keep live execution disabled."
      : healthWeightedSingleReadySymbols > 0
        ? "Single broker health-weighted allocation is ready. Continue monitoring broker health before dual execution."
        : waitingSymbols > 0
          ? "Broker health is ready but orchestration is waiting for approval."
          : "No broker passed both route and health checks. Keep execution blocked.";

  return {
    version: "V12.0.8",
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    healthWeightedDualReadySymbols,
    healthWeightedSingleReadySymbols,
    waitingSymbols,
    blockedSymbols,
    liveExecutionEnabled: false,
    readOnlyMode: true,
    decisions,
    systemRule:
      "Broker Health to Dual Broker Sync applies broker health, spread, latency, leverage and broker score to dual broker allocations. Live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
