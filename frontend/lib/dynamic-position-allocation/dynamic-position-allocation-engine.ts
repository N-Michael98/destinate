import { generateSmartBrokerExecutionSyncReport } from "../smart-broker-execution-sync";
import { BrokerId } from "../smart-broker-selection";

import {
  BrokerPositionAllocation,
  DynamicPositionAllocationInput,
  DynamicPositionAllocationReport,
  DynamicPositionAllocationResult,
  DynamicPositionAllocationStatus,
} from "./dynamic-position-allocation-types";

const VERSION = "V12.2.0" as const;

function roundLots(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function getBasePositionSizeLots(symbol: string): number {
  if (symbol === "XAUUSD") return 1.0;
  if (symbol === "EURUSD") return 0.8;
  if (symbol === "NAS100") return 0.5;

  return 0.5;
}

function getMaxPositionSizeLots(symbol: string): number {
  if (symbol === "XAUUSD") return 1.5;
  if (symbol === "EURUSD") return 1.0;
  if (symbol === "NAS100") return 0.7;

  return 0.5;
}

function getMockRiskPercent(symbol: string): number {
  if (symbol === "XAUUSD") return 1.2;
  if (symbol === "EURUSD") return 0.8;
  if (symbol === "NAS100") return 1.0;

  return 0.75;
}

function getMockConfidenceScore(symbol: string): number {
  if (symbol === "XAUUSD") return 84;
  if (symbol === "EURUSD") return 78;
  if (symbol === "NAS100") return 81;

  return 75;
}

function normalizeRequestedLots(
  totalPositionSizeLots: number,
  maxPositionSizeLots: number,
  confidenceScore: number
): number {
  const confidenceMultiplier =
    confidenceScore >= 85 ? 1 : confidenceScore >= 75 ? 0.9 : 0.75;

  const adjustedLots = totalPositionSizeLots * confidenceMultiplier;

  return roundLots(Math.min(adjustedLots, maxPositionSizeLots));
}

function buildAllocationInputFromExecutionSync(): DynamicPositionAllocationInput[] {
  const executionSyncReport = generateSmartBrokerExecutionSyncReport();

  return executionSyncReport.routeResults.map((routeResult) => {
    const totalPositionSizeLots = getBasePositionSizeLots(routeResult.symbol);
    const maxPositionSizeLots = getMaxPositionSizeLots(routeResult.symbol);
    const riskPercent = getMockRiskPercent(routeResult.symbol);
    const confidenceScore = getMockConfidenceScore(routeResult.symbol);

    return {
      queueItemId: routeResult.queueItemId,
      symbol: routeResult.symbol,
      tradeDirection: routeResult.tradeDirection,
      tradingStyle: routeResult.tradingStyle,
      priority: routeResult.priority,
      selectedBroker: routeResult.selectedBroker,
      totalPositionSizeLots,
      maxPositionSizeLots,
      riskPercent,
      confidenceScore,
      routes: routeResult.routes,
    };
  });
}

function allocateBrokerPosition(
  input: DynamicPositionAllocationInput,
  normalizedLots: number,
  brokerId: BrokerId,
  brokerName: string,
  allocationPercent: number,
  brokerScore: number,
  routeStatus: "ACTIVE" | "STANDBY" | "BLOCKED"
): BrokerPositionAllocation {
  if (routeStatus === "BLOCKED" || allocationPercent <= 0) {
    return {
      brokerId,
      brokerName,
      allocationPercent,
      brokerScore,
      lotSize: 0,
      notionalRiskPercent: 0,
      status: "BLOCKED",
      reason: `${brokerName} skipped because route is blocked or allocation is zero.`,
    };
  }

  const lotSize = roundLots(normalizedLots * (allocationPercent / 100));
  const notionalRiskPercent = roundPercent(
    input.riskPercent * (allocationPercent / 100)
  );

  return {
    brokerId,
    brokerName,
    allocationPercent,
    brokerScore,
    lotSize,
    notionalRiskPercent,
    status: lotSize > 0 ? "ACTIVE" : "SKIPPED",
    reason:
      lotSize > 0
        ? `${brokerName} receives ${lotSize} lots based on ${allocationPercent}% smart broker allocation.`
        : `${brokerName} skipped because calculated lot size is zero.`,
  };
}

function generateAllocationReason(
  input: DynamicPositionAllocationInput,
  status: DynamicPositionAllocationStatus,
  totalAllocatedLots: number,
  normalizedLots: number
): string {
  if (status === "BLOCKED") {
    return `${input.symbol} allocation blocked because no active broker route is available.`;
  }

  if (status === "PARTIAL_ALLOCATION") {
    return `${input.symbol} received partial allocation: ${totalAllocatedLots}/${normalizedLots} lots allocated.`;
  }

  return `${input.symbol} allocated ${totalAllocatedLots} lots across selected broker routes in simulation mode.`;
}

function allocatePositionForQueueItem(
  input: DynamicPositionAllocationInput
): DynamicPositionAllocationResult {
  if (input.selectedBroker === "NONE" || input.routes.length === 0) {
    return {
      queueItemId: input.queueItemId,
      symbol: input.symbol,
      tradeDirection: input.tradeDirection,
      tradingStyle: input.tradingStyle,
      priority: input.priority,
      status: "BLOCKED",
      selectedBroker: input.selectedBroker,
      totalRequestedLots: input.totalPositionSizeLots,
      totalAllocatedLots: 0,
      unallocatedLots: input.totalPositionSizeLots,
      riskPercent: input.riskPercent,
      confidenceScore: input.confidenceScore,
      allocations: [],
      allocationReason: `${input.symbol} allocation blocked because Smart Broker Execution Sync did not provide active routes.`,
    };
  }

  const normalizedLots = normalizeRequestedLots(
    input.totalPositionSizeLots,
    input.maxPositionSizeLots,
    input.confidenceScore
  );

  const allocations = input.routes.map((route) =>
    allocateBrokerPosition(
      input,
      normalizedLots,
      route.brokerId,
      route.brokerName,
      route.allocationPercent,
      route.brokerScore,
      route.routeStatus
    )
  );

  const totalAllocatedLots = roundLots(
    allocations.reduce((sum, allocation) => sum + allocation.lotSize, 0)
  );

  const unallocatedLots = roundLots(Math.max(0, normalizedLots - totalAllocatedLots));

  let status: DynamicPositionAllocationStatus = "ALLOCATED";

  if (totalAllocatedLots <= 0) {
    status = "BLOCKED";
  } else if (unallocatedLots > 0.01) {
    status = "PARTIAL_ALLOCATION";
  }

  return {
    queueItemId: input.queueItemId,
    symbol: input.symbol,
    tradeDirection: input.tradeDirection,
    tradingStyle: input.tradingStyle,
    priority: input.priority,
    status,
    selectedBroker: input.selectedBroker,
    totalRequestedLots: normalizedLots,
    totalAllocatedLots,
    unallocatedLots,
    riskPercent: input.riskPercent,
    confidenceScore: input.confidenceScore,
    allocations,
    allocationReason: generateAllocationReason(
      input,
      status,
      totalAllocatedLots,
      normalizedLots
    ),
  };
}

function resolveReportStatus(
  results: DynamicPositionAllocationResult[]
): DynamicPositionAllocationStatus {
  if (results.every((result) => result.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (results.some((result) => result.status === "PARTIAL_ALLOCATION")) {
    return "PARTIAL_ALLOCATION";
  }

  return "READY";
}

export function generateDynamicPositionAllocationReport(): DynamicPositionAllocationReport {
  const allocationInputs = buildAllocationInputFromExecutionSync();

  const results = allocationInputs.map(allocatePositionForQueueItem);

  const allocatedItems = results.filter(
    (result) => result.status === "ALLOCATED"
  ).length;

  const partialAllocationItems = results.filter(
    (result) => result.status === "PARTIAL_ALLOCATION"
  ).length;

  const blockedItems = results.filter(
    (result) => result.status === "BLOCKED"
  ).length;

  const totalRequestedLots = roundLots(
    results.reduce((sum, result) => sum + result.totalRequestedLots, 0)
  );

  const totalAllocatedLots = roundLots(
    results.reduce((sum, result) => sum + result.totalAllocatedLots, 0)
  );

  const totalUnallocatedLots = roundLots(
    results.reduce((sum, result) => sum + result.unallocatedLots, 0)
  );

  return {
    version: VERSION,
    status: resolveReportStatus(results),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalItems: results.length,
    allocatedItems,
    partialAllocationItems,
    blockedItems,
    totalRequestedLots,
    totalAllocatedLots,
    totalUnallocatedLots,
    results,
    summary:
      "Dynamic Position Allocation converted Smart Broker routing percentages into simulated broker-level lot allocations.",
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      allocationMode: "SIMULATED_POSITION_SPLIT",
    },
    createdAt: new Date().toISOString(),
  };
}
