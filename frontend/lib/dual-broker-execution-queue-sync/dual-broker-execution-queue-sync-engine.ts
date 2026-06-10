import { generateBrokerRoutingDualBrokerSyncReport } from "@/lib/broker-routing-dual-broker-sync";

import {
  DualBrokerExecutionQueueItem,
  DualBrokerExecutionQueueStatus,
  DualBrokerExecutionQueueSyncReport,
} from "./dual-broker-execution-queue-sync-types";

const VERSION = "V16.1.8" as const;

function resolveQueueStatus(mode: string): DualBrokerExecutionQueueStatus {
  if (mode === "DUAL_BROKER_READY") return "READY_FOR_PAPER_EXECUTION";
  if (mode === "SINGLE_BROKER_READY") return "SINGLE_BROKER_READY";
  if (mode === "WAITING") return "WAITING_FOR_APPROVAL";
  return "BLOCKED";
}

function resolveRequestedAction(
  status: DualBrokerExecutionQueueStatus
): DualBrokerExecutionQueueItem["requestedAction"] {
  if (
    status === "READY_FOR_PAPER_EXECUTION" ||
    status === "SINGLE_BROKER_READY"
  ) {
    return "OPEN_TRADE";
  }

  if (status === "WAITING_FOR_APPROVAL") return "WAIT";

  return "BLOCK";
}

function resolveBrokerTarget(
  status: DualBrokerExecutionQueueStatus
): DualBrokerExecutionQueueItem["brokerTarget"] {
  if (status === "READY_FOR_PAPER_EXECUTION") return "DUAL_BROKER";
  if (status === "SINGLE_BROKER_READY") return "SINGLE_BROKER";
  return "NO_BROKER";
}

function resolveExecutionMode(
  status: DualBrokerExecutionQueueStatus
): DualBrokerExecutionQueueItem["executionMode"] {
  if (
    status === "READY_FOR_PAPER_EXECUTION" ||
    status === "SINGLE_BROKER_READY"
  ) {
    return "PAPER";
  }

  return "LIVE_BLOCKED";
}

function buildQueueItem(
  decision: ReturnType<typeof generateBrokerRoutingDualBrokerSyncReport>["decisions"][number],
  index: number
): DualBrokerExecutionQueueItem {
  const queueStatus = resolveQueueStatus(decision.dualBrokerMode);
  const requestedAction = resolveRequestedAction(queueStatus);
  const brokerTarget = resolveBrokerTarget(queueStatus);
  const executionMode = resolveExecutionMode(queueStatus);

  const allocatedPositionSize =
    requestedAction === "OPEN_TRADE" ? decision.totalAllocatedPositionSize : 0;

  const reason =
    queueStatus === "READY_FOR_PAPER_EXECUTION"
      ? `${decision.symbol}: Dual broker decision approved and queued for paper execution.`
      : queueStatus === "SINGLE_BROKER_READY"
        ? `${decision.symbol}: Single broker decision approved and queued for paper execution.`
        : queueStatus === "WAITING_FOR_APPROVAL"
          ? `${decision.symbol}: Execution queue waits for approval before paper execution.`
          : `${decision.symbol}: Execution queue blocked because dual broker decision is blocked.`;

  return {
    id: `dual-broker-execution-queue-${decision.symbol.toLowerCase()}`,
    queueRank: index + 1,
    symbol: decision.symbol,
    tradingStyle: decision.tradingStyle,
    direction: decision.direction,
    queueStatus,
    requestedAction,
    brokerTarget,
    preferredBroker: decision.preferredBroker,
    secondaryBroker: decision.secondaryBroker,
    executionPriority: decision.executionPriority,
    originalPositionSize: decision.originalPositionSize,
    allocatedPositionSize,
    executionMode,
    readOnlySafe: true,
    liveExecutionBlocked: true,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function generateDualBrokerExecutionQueueSyncReport():
  DualBrokerExecutionQueueSyncReport {
  const dualBroker = generateBrokerRoutingDualBrokerSyncReport();

  const queue = dualBroker.decisions
    .sort((a, b) => b.executionPriority - a.executionPriority)
    .map(buildQueueItem);

  const readyForPaperExecution = queue.filter(
    (item) => item.queueStatus === "READY_FOR_PAPER_EXECUTION"
  ).length;

  const singleBrokerReady = queue.filter(
    (item) => item.queueStatus === "SINGLE_BROKER_READY"
  ).length;

  const waitingItems = queue.filter(
    (item) => item.queueStatus === "WAITING_FOR_APPROVAL"
  ).length;

  const blockedItems = queue.filter(
    (item) => item.queueStatus === "BLOCKED"
  ).length;

  const executionAllowed =
    readyForPaperExecution > 0 || singleBrokerReady > 0;

  const recommendation =
    readyForPaperExecution > 0
      ? "Dual broker paper execution queue is ready. Live execution remains blocked."
      : singleBrokerReady > 0
        ? "Single broker paper execution queue is ready. Continue dual broker validation."
        : waitingItems > 0
          ? "Execution queue is waiting for approval."
          : "Execution queue blocks all execution.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalItems: queue.length,
    readyForPaperExecution,
    singleBrokerReady,
    waitingItems,
    blockedItems,
    executionAllowed,
    liveExecutionEnabled: false,
    queue,
    systemRule:
      "Dual Broker Execution Queue Sync converts V16 dual-broker orchestration into paper execution queue items. Live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
