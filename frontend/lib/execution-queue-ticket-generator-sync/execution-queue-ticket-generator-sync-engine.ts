import { generateDualBrokerExecutionQueueSyncReport } from "@/lib/dual-broker-execution-queue-sync";

import {
  ExecutionQueueTicket,
  ExecutionQueueTicketAction,
  ExecutionQueueTicketGeneratorSyncReport,
  ExecutionTicketStatus,
} from "./execution-queue-ticket-generator-sync-types";

const VERSION = "V16.1.9" as const;

function buildTicketId(symbol: string, rank: number) {
  return `EXEC-${symbol.toUpperCase()}-${String(rank).padStart(3, "0")}`;
}

function resolveSide(direction: string): ExecutionQueueTicket["side"] {
  if (direction === "LONG") return "BUY";
  if (direction === "SHORT") return "SELL";
  return "NONE";
}

function resolveTicketStatus(queueStatus: string): ExecutionTicketStatus {
  if (
    queueStatus === "READY_FOR_PAPER_EXECUTION" ||
    queueStatus === "SINGLE_BROKER_READY"
  ) {
    return "READY";
  }

  if (queueStatus === "WAITING_FOR_APPROVAL") return "WAITING";

  return "BLOCKED";
}

function resolveAction(params: {
  queueStatus: string;
  brokerTarget: string;
}): ExecutionTicketAction {
  if (
    params.queueStatus === "READY_FOR_PAPER_EXECUTION" &&
    params.brokerTarget === "DUAL_BROKER"
  ) {
    return "CREATE_PAPER_EXECUTION_TICKET";
  }

  if (
    params.queueStatus === "SINGLE_BROKER_READY" &&
    params.brokerTarget === "SINGLE_BROKER"
  ) {
    return "CREATE_SINGLE_BROKER_TICKET";
  }

  if (params.queueStatus === "WAITING_FOR_APPROVAL") return "WAIT";

  return "BLOCK";
}

function estimateFillQuality(params: {
  brokerTarget: string;
  executionPriority: number;
}) {
  const targetBoost =
    params.brokerTarget === "DUAL_BROKER"
      ? 6
      : params.brokerTarget === "SINGLE_BROKER"
        ? 2
        : -20;

  return Math.max(
    0,
    Math.min(100, Math.round(params.executionPriority * 0.85 + targetBoost))
  );
}

function estimateLatencyMs(brokerTarget: string) {
  if (brokerTarget === "DUAL_BROKER") return 84;
  if (brokerTarget === "SINGLE_BROKER") return 96;
  return 0;
}

function resolveMaxSlippagePercent(params: {
  ticketStatus: ExecutionTicketStatus;
  brokerTarget: string;
}) {
  if (params.ticketStatus !== "READY") return 0;
  if (params.brokerTarget === "DUAL_BROKER") return 0.12;
  if (params.brokerTarget === "SINGLE_BROKER") return 0.18;
  return 0;
}

function buildReason(params: {
  symbol: string;
  ticketStatus: ExecutionTicketStatus;
  action: ExecutionTicketAction;
  brokerTarget: string;
}) {
  if (params.ticketStatus === "BLOCKED") {
    return `${params.symbol}: Execution ticket blocked because queue item is not executable.`;
  }

  if (params.ticketStatus === "WAITING") {
    return `${params.symbol}: Execution ticket waiting for approval before paper execution.`;
  }

  return `${params.symbol}: ${params.action} generated for ${params.brokerTarget} paper execution.`;
}

function buildTicket(
  item: ReturnType<typeof generateDualBrokerExecutionQueueSyncReport>["queue"][number]
): ExecutionQueueTicket {
  const ticketStatus = resolveTicketStatus(item.queueStatus);
  const action = resolveAction({
    queueStatus: item.queueStatus,
    brokerTarget: item.brokerTarget,
  });

  const side = resolveSide(item.direction);
  const estimatedFillQuality = estimateFillQuality({
    brokerTarget: item.brokerTarget,
    executionPriority: item.executionPriority,
  });

  return {
    ticketId: buildTicketId(item.symbol, item.queueRank),
    sourceQueueId: item.id,
    queueRank: item.queueRank,
    symbol: item.symbol,
    side,
    tradingStyle: item.tradingStyle,
    brokerTarget: item.brokerTarget,
    preferredBroker: item.preferredBroker,
    secondaryBroker: item.secondaryBroker,
    action,
    ticketStatus,
    executionMode: ticketStatus === "READY" ? "PAPER" : "LIVE_BLOCKED",
    executionPriority: item.executionPriority,
    originalPositionSize: item.originalPositionSize,
    allocatedPositionSize:
      ticketStatus === "READY" ? item.allocatedPositionSize : 0,
    estimatedFillQuality: ticketStatus === "READY" ? estimatedFillQuality : 0,
    estimatedLatencyMs:
      ticketStatus === "READY" ? estimateLatencyMs(item.brokerTarget) : 0,
    maxSlippagePercent: resolveMaxSlippagePercent({
      ticketStatus,
      brokerTarget: item.brokerTarget,
    }),
    riskLockEnabled: true,
    readOnlySafe: true,
    liveExecutionBlocked: true,
    reason: buildReason({
      symbol: item.symbol,
      ticketStatus,
      action,
      brokerTarget: item.brokerTarget,
    }),
    createdAt: new Date().toISOString(),
  };
}

export function generateExecutionQueueTicketGeneratorSyncReport():
  ExecutionQueueTicketGeneratorSyncReport {
  const queue = generateDualBrokerExecutionQueueSyncReport();

  const tickets = queue.queue
    .map(buildTicket)
    .sort((a, b) => b.executionPriority - a.executionPriority);

  const readyTickets = tickets.filter(
    (ticket) => ticket.ticketStatus === "READY"
  ).length;

  const waitingTickets = tickets.filter(
    (ticket) => ticket.ticketStatus === "WAITING"
  ).length;

  const blockedTickets = tickets.filter(
    (ticket) => ticket.ticketStatus === "BLOCKED"
  ).length;

  const dualBrokerTickets = tickets.filter(
    (ticket) => ticket.brokerTarget === "DUAL_BROKER"
  ).length;

  const singleBrokerTickets = tickets.filter(
    (ticket) => ticket.brokerTarget === "SINGLE_BROKER"
  ).length;

  const recommendation =
    readyTickets > 0
      ? "Execution tickets are ready for paper-order conversion. Live execution remains blocked."
      : waitingTickets > 0
        ? "Execution tickets are waiting for approval."
        : "Execution tickets are blocked.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalQueueItems: queue.totalItems,
    readyTickets,
    waitingTickets,
    blockedTickets,
    dualBrokerTickets,
    singleBrokerTickets,
    liveExecutionEnabled: false,
    tickets,
    systemRule:
      "Execution Queue Ticket Generator Sync converts V16 execution queue items into paper execution tickets. No live orders are sent.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
