import { generateExecutionQueuePositionSyncReport } from "@/lib/execution-queue-position-sync";
import { PositionSyncedQueueItem, SyncedBrokerAllocation } from "@/lib/execution-queue-position-sync";

import {
  ExecutionPositionTicket,
  ExecutionPositionTicketAction,
  ExecutionPositionTicketStatus,
  ExecutionPositionTicketSyncReport,
  EvolvedBrokerTicketAllocation,
} from "./execution-position-ticket-sync-types";

const VERSION = "V16.3.1" as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildTicketId(symbol: string, index: number): string {
  return `EVOPOS-${symbol.toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
}

function resolveTicketStatus(
  item: PositionSyncedQueueItem
): ExecutionPositionTicketStatus {
  if (item.syncStatus === "BLOCKED") return "BLOCKED";
  if (!item.readyForPaperExecution) return "WAITING";
  return "READY";
}

function resolveAction(
  status: ExecutionPositionTicketStatus,
  item: PositionSyncedQueueItem
): ExecutionPositionTicketAction {
  if (status === "BLOCKED") return "BLOCK";
  if (status === "WAITING") return "WAIT";

  const hasMultipleBrokers =
    item.brokerAllocations.filter((a) => a.status === "ACTIVE").length > 1;

  return hasMultipleBrokers
    ? "CREATE_EVOLVED_PAPER_TICKET"
    : "CREATE_SINGLE_BROKER_TICKET";
}

function estimateFillQuality(item: PositionSyncedQueueItem): number {
  const activeBrokers = item.brokerAllocations.filter(
    (a) => a.status === "ACTIVE"
  ).length;
  const confidenceBoost = item.confidenceScore >= 85 ? 8 : item.confidenceScore >= 75 ? 4 : 0;
  const brokerBoost = activeBrokers > 1 ? 6 : activeBrokers === 1 ? 2 : -20;
  return Math.max(0, Math.min(100, Math.round(item.confidenceScore * 0.7 + confidenceBoost + brokerBoost)));
}

function estimateLatencyMs(item: PositionSyncedQueueItem): number {
  const activeBrokers = item.brokerAllocations.filter(
    (a) => a.status === "ACTIVE"
  ).length;
  if (activeBrokers > 1) return 82;
  if (activeBrokers === 1) return 94;
  return 0;
}

function resolveMaxSlippage(status: ExecutionPositionTicketStatus, item: PositionSyncedQueueItem): number {
  if (status !== "READY") return 0;
  const activeBrokers = item.brokerAllocations.filter((a) => a.status === "ACTIVE").length;
  return activeBrokers > 1 ? 0.11 : 0.17;
}

function mapBrokerAllocation(
  allocation: SyncedBrokerAllocation
): EvolvedBrokerTicketAllocation {
  return {
    brokerId: allocation.brokerId,
    brokerName: allocation.brokerName,
    allocationPercent: allocation.allocationPercent,
    lotSize: allocation.lotSize,
    notionalRiskPercent: allocation.notionalRiskPercent,
    status: allocation.status,
  };
}

function buildReason(
  item: PositionSyncedQueueItem,
  status: ExecutionPositionTicketStatus,
  action: ExecutionPositionTicketAction
): string {
  if (status === "BLOCKED") {
    return `${item.symbol}: Evolved ticket blocked — position sync produced no active broker allocation.`;
  }
  if (status === "WAITING") {
    return `${item.symbol}: Evolved ticket waiting — position sync is partially resolved.`;
  }
  return `${item.symbol}: ${action} — ${item.evolvedAllocatedLots} evolved lots ready across ${item.brokerAllocations.filter((a) => a.status === "ACTIVE").length} broker(s). Confidence ${item.confidenceScore}%.`;
}

function buildTicket(item: PositionSyncedQueueItem, index: number): ExecutionPositionTicket {
  const ticketStatus = resolveTicketStatus(item);
  const action = resolveAction(ticketStatus, item);
  const fillQuality = ticketStatus === "READY" ? estimateFillQuality(item) : 0;
  const latencyMs = ticketStatus === "READY" ? estimateLatencyMs(item) : 0;

  return {
    ticketId: buildTicketId(item.symbol, index),
    sourceQueueItemId: item.queueItemId,
    symbol: item.symbol,
    side: item.side,
    tradingStyle: item.tradingStyle,
    priority: item.priority,
    selectedBroker: item.selectedBroker,
    ticketStatus,
    action,
    executionMode: ticketStatus === "READY" ? "PAPER" : "LIVE_BLOCKED",
    originalRequestedLots: item.originalRequestedLots,
    evolvedAllocatedLots: ticketStatus === "READY" ? item.evolvedAllocatedLots : 0,
    riskPercent: item.riskPercent,
    confidenceScore: item.confidenceScore,
    brokerAllocations: item.brokerAllocations.map(mapBrokerAllocation),
    estimatedFillQuality: fillQuality,
    estimatedLatencyMs: latencyMs,
    maxSlippagePercent: resolveMaxSlippage(ticketStatus, item),
    riskLockEnabled: true,
    readOnlySafe: true,
    liveExecutionBlocked: true,
    reason: buildReason(item, ticketStatus, action),
    createdAt: new Date().toISOString(),
  };
}

export function generateExecutionPositionTicketSyncReport(): ExecutionPositionTicketSyncReport {
  const positionSyncReport = generateExecutionQueuePositionSyncReport();

  const tickets = positionSyncReport.items
    .map(buildTicket)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const readyTickets = tickets.filter((t) => t.ticketStatus === "READY").length;
  const waitingTickets = tickets.filter((t) => t.ticketStatus === "WAITING").length;
  const blockedTickets = tickets.filter((t) => t.ticketStatus === "BLOCKED").length;

  const totalEvolvedLots = round2(
    tickets.reduce((sum, t) => sum + t.evolvedAllocatedLots, 0)
  );

  const recommendation =
    readyTickets > 0
      ? "Evolved execution tickets ready for paper order creation. Loop proceeds to Paper Order Sync."
      : waitingTickets > 0
        ? "Evolved tickets waiting — partial sync resolved."
        : "All evolved tickets blocked — no active broker positions available.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalItems: tickets.length,
    readyTickets,
    waitingTickets,
    blockedTickets,
    totalEvolvedLots,
    liveExecutionEnabled: false,
    tickets,
    systemRule:
      "Execution Position Ticket Sync converts V16.3.0 position-synced queue items into evolved execution tickets carrying broker-level lot allocations from the full evolution chain. No live orders are sent.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
