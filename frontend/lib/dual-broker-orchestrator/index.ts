import type {
  BrokerAllocationDecision,
  BrokerName,
  BrokerSyncInput,
  DualBrokerMode,
  DualBrokerOrchestratorReport,
  DualBrokerSymbolDecision,
  TradingStyle,
} from "./dual-broker-orchestrator-types";

const brokerSyncInputs: BrokerSyncInput[] = [
  {
    broker: "IC_MARKETS",
    symbol: "NAS100",
    tradingStyle: "SWING",
    direction: "LONG",
    routeStatus: "BLOCKED",
    eligible: false,
    leverage: 500,
    leverageRiskMultiplier: 0,
    adjustedPositionSize: 0,
    originalPositionSize: 960,
    executionPriority: 100,
    queuePosition: 1,
    readOnlySafe: true,
    liveExecutionBlocked: true,
  },
  {
    broker: "CAPITAL_COM",
    symbol: "NAS100",
    tradingStyle: "SWING",
    direction: "LONG",
    routeStatus: "SYNCED",
    eligible: true,
    leverage: 200,
    leverageRiskMultiplier: 0.75,
    adjustedPositionSize: 720,
    originalPositionSize: 960,
    executionPriority: 100,
    queuePosition: 1,
    readOnlySafe: true,
    liveExecutionBlocked: true,
  },
  {
    broker: "IC_MARKETS",
    symbol: "XAUUSD",
    tradingStyle: "SCALPING",
    direction: "LONG",
    routeStatus: "WAITING_FOR_APPROVAL",
    eligible: true,
    leverage: 500,
    leverageRiskMultiplier: 0.35,
    adjustedPositionSize: 0,
    originalPositionSize: 0,
    executionPriority: 93.8,
    queuePosition: 2,
    readOnlySafe: true,
    liveExecutionBlocked: true,
  },
  {
    broker: "CAPITAL_COM",
    symbol: "XAUUSD",
    tradingStyle: "SCALPING",
    direction: "LONG",
    routeStatus: "BLOCKED",
    eligible: false,
    leverage: 200,
    leverageRiskMultiplier: 0,
    adjustedPositionSize: 0,
    originalPositionSize: 0,
    executionPriority: 93.8,
    queuePosition: 2,
    readOnlySafe: true,
    liveExecutionBlocked: true,
  },
  {
    broker: "IC_MARKETS",
    symbol: "SPX500",
    tradingStyle: "NONE",
    direction: "NEUTRAL",
    routeStatus: "BLOCKED",
    eligible: false,
    leverage: 500,
    leverageRiskMultiplier: 0,
    adjustedPositionSize: 0,
    originalPositionSize: 0,
    executionPriority: 0,
    queuePosition: 0,
    readOnlySafe: true,
    liveExecutionBlocked: true,
  },
  {
    broker: "CAPITAL_COM",
    symbol: "SPX500",
    tradingStyle: "NONE",
    direction: "NEUTRAL",
    routeStatus: "BLOCKED",
    eligible: false,
    leverage: 200,
    leverageRiskMultiplier: 0,
    adjustedPositionSize: 0,
    originalPositionSize: 0,
    executionPriority: 0,
    queuePosition: 0,
    readOnlySafe: true,
    liveExecutionBlocked: true,
  },
];

function groupBySymbol(inputs: BrokerSyncInput[]) {
  return inputs.reduce<Record<string, BrokerSyncInput[]>>((groups, input) => {
    if (!groups[input.symbol]) {
      groups[input.symbol] = [];
    }

    groups[input.symbol].push(input);
    return groups;
  }, {});
}

function resolveBrokerStatus(input: BrokerSyncInput) {
  if (!input.eligible || input.routeStatus === "BLOCKED") return "BLOCKED";
  if (input.routeStatus === "WAITING_FOR_APPROVAL") return "WAITING";
  return "APPROVED";
}

function resolveDualBrokerMode(inputs: BrokerSyncInput[]): DualBrokerMode {
  const approved = inputs.filter((input) => resolveBrokerStatus(input) === "APPROVED");
  const waiting = inputs.filter((input) => resolveBrokerStatus(input) === "WAITING");

  if (approved.length >= 2) return "DUAL_BROKER_READY";
  if (approved.length === 1) return "SINGLE_BROKER_READY";
  if (waiting.length > 0) return "WAITING";
  return "BLOCKED";
}

function resolveAllocationPercent(input: BrokerSyncInput, mode: DualBrokerMode) {
  if (resolveBrokerStatus(input) !== "APPROVED") return 0;

  if (mode === "DUAL_BROKER_READY") {
    if (input.broker === "IC_MARKETS") return 40;
    if (input.broker === "CAPITAL_COM") return 60;
  }

  if (mode === "SINGLE_BROKER_READY") return 100;

  return 0;
}

function resolvePreferredBroker(allocations: BrokerAllocationDecision[]): BrokerName {
  const active = allocations
    .filter((allocation) => allocation.brokerDecisionStatus === "APPROVED")
    .sort((a, b) => b.allocationPercent - a.allocationPercent);

  return active[0]?.broker ?? "NO_BROKER";
}

function resolveSecondaryBroker(allocations: BrokerAllocationDecision[]): BrokerName {
  const active = allocations
    .filter((allocation) => allocation.brokerDecisionStatus === "APPROVED")
    .sort((a, b) => b.allocationPercent - a.allocationPercent);

  return active[1]?.broker ?? "NO_BROKER";
}

function buildAllocation(
  input: BrokerSyncInput,
  mode: DualBrokerMode,
): BrokerAllocationDecision {
  const brokerDecisionStatus = resolveBrokerStatus(input);
  const allocationPercent = resolveAllocationPercent(input, mode);

  const allocatedPositionSize =
    brokerDecisionStatus === "APPROVED"
      ? Number(((input.adjustedPositionSize * allocationPercent) / 100).toFixed(2))
      : 0;

  const reason =
    brokerDecisionStatus === "APPROVED"
      ? `${input.broker}: approved with ${allocationPercent}% allocation and broker-specific leverage risk adjustment.`
      : brokerDecisionStatus === "WAITING"
        ? `${input.broker}: waiting for approval. No allocation until confirmation.`
        : `${input.broker}: blocked or not eligible. No allocation.`;

  return {
    broker: input.broker,
    brokerDecisionStatus,
    eligible: input.eligible,
    leverage: input.leverage,
    leverageRiskMultiplier: input.leverageRiskMultiplier,
    allocationPercent,
    allocatedPositionSize,
    executionPriority: input.executionPriority,
    reason,
  };
}

function buildSymbolDecision(
  symbol: string,
  inputs: BrokerSyncInput[],
): DualBrokerSymbolDecision {
  const dualBrokerMode = resolveDualBrokerMode(inputs);
  const allocations = inputs.map((input) => buildAllocation(input, dualBrokerMode));

  const approvedAllocations = allocations.filter(
    (allocation) => allocation.brokerDecisionStatus === "APPROVED",
  );

  const totalAllocatedPositionSize = Number(
    approvedAllocations
      .reduce((sum, allocation) => sum + allocation.allocatedPositionSize, 0)
      .toFixed(2),
  );

  const firstInput = inputs[0];

  const finalDecisionStatus =
    dualBrokerMode === "DUAL_BROKER_READY" || dualBrokerMode === "SINGLE_BROKER_READY"
      ? "APPROVED"
      : dualBrokerMode === "WAITING"
        ? "WAITING"
        : "BLOCKED";

  const preferredBroker = resolvePreferredBroker(allocations);
  const secondaryBroker = resolveSecondaryBroker(allocations);

  const readOnlySafe = inputs.every((input) => input.readOnlySafe);
  const liveExecutionBlocked = inputs.every((input) => input.liveExecutionBlocked);

  const reason =
    dualBrokerMode === "DUAL_BROKER_READY"
      ? `${symbol}: Both brokers are approved. Dual broker allocation is prepared in read-only simulation mode.`
      : dualBrokerMode === "SINGLE_BROKER_READY"
        ? `${symbol}: One broker is approved. Single broker route is prepared in read-only simulation mode.`
        : dualBrokerMode === "WAITING"
          ? `${symbol}: Broker orchestration is waiting for strict approval or execution unlock.`
          : `${symbol}: No broker route is approved. Execution remains blocked.`;

  return {
    id: `dual-broker-${symbol.toLowerCase()}`,
    symbol,
    tradingStyle: firstInput.tradingStyle,
    direction: firstInput.direction,
    dualBrokerMode,
    finalDecisionStatus,
    totalAllocatedPositionSize,
    preferredBroker,
    secondaryBroker,
    useDualBrokerExecution: dualBrokerMode === "DUAL_BROKER_READY",
    readOnlySafe,
    liveExecutionBlocked,
    allocations,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function getDualBrokerOrchestratorReport(): DualBrokerOrchestratorReport {
  const groupedInputs = groupBySymbol(brokerSyncInputs);
  const decisions = Object.entries(groupedInputs).map(([symbol, inputs]) =>
    buildSymbolDecision(symbol, inputs),
  );

  const dualBrokerReadySymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "DUAL_BROKER_READY",
  ).length;

  const singleBrokerReadySymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "SINGLE_BROKER_READY",
  ).length;

  const waitingSymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "WAITING",
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.dualBrokerMode === "BLOCKED",
  ).length;

  const recommendation =
    dualBrokerReadySymbols > 0
      ? "Dual broker execution is prepared in simulation mode. Keep live execution disabled until risk controls and manual confirmation are complete."
      : singleBrokerReadySymbols > 0
        ? "Single broker routes are ready. Continue building dual broker confirmation before live execution."
        : waitingSymbols > 0
          ? "Broker orchestration is waiting for approval. Keep all live execution disabled."
          : "No broker route is approved. Execution remains blocked.";

  return {
    version: "V12.0.6",
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
      "Dual Broker Orchestrator combines IC Markets and Capital.com sync states, applies broker-specific leverage risk adjustments and prepares allocation decisions. Live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
