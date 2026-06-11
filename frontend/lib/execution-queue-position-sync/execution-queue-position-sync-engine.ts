import { generateDynamicPositionAllocationReport } from "@/lib/dynamic-position-allocation";
import {
  DynamicPositionAllocationResult,
  BrokerPositionAllocation,
} from "@/lib/dynamic-position-allocation";

import {
  ExecutionQueuePositionSyncReport,
  ExecutionQueuePositionSyncStatus,
  PositionSyncedQueueItem,
  SyncedBrokerAllocation,
} from "./execution-queue-position-sync-types";

const VERSION = "V16.3.0" as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveSide(direction: string): PositionSyncedQueueItem["side"] {
  if (direction === "LONG") return "BUY";
  if (direction === "SHORT") return "SELL";
  return "NONE";
}

function mapBrokerAllocation(
  allocation: BrokerPositionAllocation
): SyncedBrokerAllocation {
  return {
    brokerId: allocation.brokerId,
    brokerName: allocation.brokerName,
    allocationPercent: allocation.allocationPercent,
    brokerScore: allocation.brokerScore,
    lotSize: allocation.lotSize,
    notionalRiskPercent: allocation.notionalRiskPercent,
    status: allocation.status,
    reason: allocation.reason,
  };
}

function resolveItemSyncStatus(
  result: DynamicPositionAllocationResult
): ExecutionQueuePositionSyncStatus {
  if (result.status === "BLOCKED") return "BLOCKED";
  if (result.status === "PARTIAL_ALLOCATION") return "PARTIAL_SYNC";
  if (result.status === "ALLOCATED") return "SYNCED";
  return "BLOCKED";
}

function buildSyncReason(
  result: DynamicPositionAllocationResult,
  syncStatus: ExecutionQueuePositionSyncStatus
): string {
  if (syncStatus === "BLOCKED") {
    return `${result.symbol}: Position sync blocked — no active broker allocation available from Dynamic Position Allocation.`;
  }

  if (syncStatus === "PARTIAL_SYNC") {
    return `${result.symbol}: Partial sync — ${result.totalAllocatedLots}/${result.totalRequestedLots} evolved lots injected into execution queue.`;
  }

  return `${result.symbol}: Position sync complete — ${result.totalAllocatedLots} evolved lots injected across ${result.allocations.filter((a) => a.status === "ACTIVE").length} broker route(s) using V16.3.0 Execution Queue Position Sync.`;
}

function buildPositionSyncedQueueItem(
  result: DynamicPositionAllocationResult
): PositionSyncedQueueItem {
  const syncStatus = resolveItemSyncStatus(result);
  const brokerAllocations = result.allocations.map(mapBrokerAllocation);
  const readyForPaperExecution =
    syncStatus === "SYNCED" || syncStatus === "PARTIAL_SYNC";

  return {
    queueItemId: result.queueItemId,
    symbol: result.symbol,
    side: resolveSide(result.tradeDirection),
    tradingStyle: result.tradingStyle,
    priority: result.priority,
    selectedBroker: result.selectedBroker,
    originalRequestedLots: result.totalRequestedLots,
    evolvedAllocatedLots: result.totalAllocatedLots,
    unallocatedLots: result.unallocatedLots,
    riskPercent: result.riskPercent,
    confidenceScore: result.confidenceScore,
    brokerAllocations,
    syncStatus,
    readyForPaperExecution,
    liveExecutionBlocked: true,
    syncReason: buildSyncReason(result, syncStatus),
  };
}

function resolveReportStatus(
  items: PositionSyncedQueueItem[]
): ExecutionQueuePositionSyncStatus {
  if (items.every((item) => item.syncStatus === "BLOCKED")) return "BLOCKED";
  if (items.some((item) => item.syncStatus === "PARTIAL_SYNC")) return "PARTIAL_SYNC";
  if (items.every((item) => item.syncStatus === "SYNCED")) return "READY";
  return "READY";
}

export function generateExecutionQueuePositionSyncReport(): ExecutionQueuePositionSyncReport {
  const allocationReport = generateDynamicPositionAllocationReport();

  const items = allocationReport.results.map(buildPositionSyncedQueueItem);

  const syncedItems = items.filter((item) => item.syncStatus === "SYNCED").length;
  const partialSyncItems = items.filter(
    (item) => item.syncStatus === "PARTIAL_SYNC"
  ).length;
  const blockedItems = items.filter((item) => item.syncStatus === "BLOCKED").length;
  const readyForPaperExecutionItems = items.filter(
    (item) => item.readyForPaperExecution
  ).length;

  const totalEvolvedLots = round2(
    items.reduce((sum, item) => sum + item.evolvedAllocatedLots, 0)
  );
  const totalUnallocatedLots = round2(
    items.reduce((sum, item) => sum + item.unallocatedLots, 0)
  );

  return {
    version: VERSION,
    status: resolveReportStatus(items),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalItems: items.length,
    syncedItems,
    partialSyncItems,
    blockedItems,
    readyForPaperExecutionItems,
    totalEvolvedLots,
    totalUnallocatedLots,
    items,
    summary:
      "Execution Queue Position Sync injected evolved broker lot allocations from V16.2.9 Dynamic Position Allocation into execution queue items. Items are now ready for paper execution ticket generation.",
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      positionSyncMode: "EVOLVED_ALLOCATION_INJECT",
    },
    updatedAt: new Date().toISOString(),
  };
}
