import { generateExecutionQueueTicketGeneratorSyncReport } from "@/lib/execution-queue-ticket-generator-sync";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";
import type { PaperDirection } from "@/lib/paper-trading/paper-types";

import {
  ExecutionTicketPaperOrderDecision,
  ExecutionTicketPaperOrderSyncReport,
} from "./execution-ticket-paper-order-sync-types";

const VERSION = "V16.2.0" as const;

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function resolvePaperDirection(side: string): PaperDirection | null {
  if (side === "BUY") return "BUY";
  if (side === "SELL") return "SELL";
  return null;
}

function estimateEntry(symbol: string, side: string) {
  const basePrices: Record<string, number> = {
    NAS100: 19250,
    XAUUSD: 3372,
    USOIL: 78.4,
    EURUSD: 1.0842,
    BTCUSD: 68250,
    SPX500: 5400,
  };

  const base = basePrices[symbol] ?? 100;

  if (side === "BUY") return base;
  if (side === "SELL") return base;

  return base;
}

function buildRiskLevels(params: {
  entry: number;
  side: "BUY" | "SELL";
  symbol: string;
}) {
  const riskDistanceBySymbol: Record<string, number> = {
    NAS100: 80,
    XAUUSD: 15,
    USOIL: 0.8,
    EURUSD: 0.006,
    BTCUSD: 900,
    SPX500: 25,
  };

  const riskDistance = riskDistanceBySymbol[params.symbol] ?? 1;
  const rewardOne = riskDistance * 1.5;
  const rewardTwo = riskDistance * 2.5;

  if (params.side === "BUY") {
    return {
      stopLoss: round(params.entry - riskDistance, 5),
      takeProfit1: round(params.entry + rewardOne, 5),
      takeProfit2: round(params.entry + rewardTwo, 5),
    };
  }

  return {
    stopLoss: round(params.entry + riskDistance, 5),
    takeProfit1: round(params.entry - rewardOne, 5),
    takeProfit2: round(params.entry - rewardTwo, 5),
  };
}

function resolveConfidence(params: {
  executionPriority: number;
  estimatedFillQuality: number;
}) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(params.executionPriority * 0.65 + params.estimatedFillQuality * 0.35)
    )
  );
}

function resolvePaperSize(allocatedPositionSize: number) {
  if (allocatedPositionSize <= 0) return 0;

  return Math.max(0.01, round(allocatedPositionSize / 1000, 3));
}

function buildBlockedDecision(params: {
  ticketId: string;
  symbol: string;
  side: string;
  status: ExecutionTicketPaperOrderDecision["status"];
  reason: string;
}): ExecutionTicketPaperOrderDecision {
  return {
    id: `paper-order-sync-${params.symbol.toLowerCase()}-${params.ticketId.toLowerCase()}`,
    sourceTicketId: params.ticketId,
    symbol: params.symbol,
    direction:
      params.side === "BUY" || params.side === "SELL"
        ? params.side
        : "NONE",
    status: params.status,
    orderId: null,
    positionId: null,
    brokerTarget: "NO_BROKER",
    preferredBroker: "NO_BROKER",
    secondaryBroker: "NO_BROKER",
    entry: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    confidence: 0,
    requestedSize: 0,
    createdOrderStatus: null,
    openedPositionStatus: null,
    accountBalance: null,
    accountEquity: null,
    accountOpenPositions: null,
    liveExecutionEnabled: false,
    reason: params.reason,
  };
}

function buildDecision(
  ticket: ReturnType<typeof generateExecutionQueueTicketGeneratorSyncReport>["tickets"][number]
): ExecutionTicketPaperOrderDecision {
  if (ticket.ticketStatus === "WAITING") {
    return buildBlockedDecision({
      ticketId: ticket.ticketId,
      symbol: ticket.symbol,
      side: ticket.side,
      status: "PAPER_ORDER_WAITING",
      reason: `${ticket.symbol}: Paper order waiting because execution ticket is waiting for approval.`,
    });
  }

  if (
    ticket.ticketStatus === "BLOCKED" ||
    ticket.action === "BLOCK" ||
    ticket.side === "NONE"
  ) {
    return buildBlockedDecision({
      ticketId: ticket.ticketId,
      symbol: ticket.symbol,
      side: ticket.side,
      status: "PAPER_ORDER_BLOCKED",
      reason: `${ticket.symbol}: Paper order blocked because execution ticket is not executable.`,
    });
  }

  const direction = resolvePaperDirection(ticket.side);

  if (direction === null) {
    return buildBlockedDecision({
      ticketId: ticket.ticketId,
      symbol: ticket.symbol,
      side: ticket.side,
      status: "PAPER_ORDER_BLOCKED",
      reason: `${ticket.symbol}: Paper order blocked because direction is missing.`,
    });
  }

  const entry = estimateEntry(ticket.symbol, ticket.side);
  const riskLevels = buildRiskLevels({
    entry,
    side: direction,
    symbol: ticket.symbol,
  });

  const confidence = resolveConfidence({
    executionPriority: ticket.executionPriority,
    estimatedFillQuality: ticket.estimatedFillQuality,
  });

  const requestedSize = resolvePaperSize(ticket.allocatedPositionSize);

  const result = paperTradingManager.createAndFillPaperOrder(
    ticket.symbol,
    direction,
    entry,
    riskLevels.stopLoss,
    riskLevels.takeProfit1,
    riskLevels.takeProfit2,
    confidence,
    `${ticket.ticketId}: ${ticket.reason}`,
    requestedSize
  );

  return {
    id: `paper-order-sync-${ticket.symbol.toLowerCase()}-${ticket.ticketId.toLowerCase()}`,
    sourceTicketId: ticket.ticketId,
    symbol: ticket.symbol,
    direction,
    status: "PAPER_ORDER_CREATED",
    orderId: result.order.id,
    positionId: result.position.id,
    brokerTarget: ticket.brokerTarget,
    preferredBroker: ticket.preferredBroker,
    secondaryBroker: ticket.secondaryBroker,
    entry,
    stopLoss: riskLevels.stopLoss,
    takeProfit1: riskLevels.takeProfit1,
    takeProfit2: riskLevels.takeProfit2,
    confidence,
    requestedSize,
    createdOrderStatus: result.order.status,
    openedPositionStatus: result.position.status,
    accountBalance: result.account.balance,
    accountEquity: result.account.equity,
    accountOpenPositions: result.account.openPositions,
    liveExecutionEnabled: false,
    reason: `${ticket.symbol}: Paper order created and filled from V16 execution ticket ${ticket.ticketId}.`,
  };
}

export function generateExecutionTicketPaperOrderSyncReport():
  ExecutionTicketPaperOrderSyncReport {
  const ticketReport = generateExecutionQueueTicketGeneratorSyncReport();

  const decisions = ticketReport.tickets.map(buildDecision);

  const createdOrders = decisions.filter(
    (decision) => decision.status === "PAPER_ORDER_CREATED"
  ).length;

  const waitingOrders = decisions.filter(
    (decision) => decision.status === "PAPER_ORDER_WAITING"
  ).length;

  const blockedOrders = decisions.filter(
    (decision) => decision.status === "PAPER_ORDER_BLOCKED"
  ).length;

  const recommendation =
    createdOrders > 0
      ? "Paper orders were created from V16 execution tickets. Continue with Paper Position Sync."
      : waitingOrders > 0
        ? "Paper orders are waiting for approval."
        : "No paper orders were created.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalTickets: ticketReport.tickets.length,
    createdOrders,
    waitingOrders,
    blockedOrders,
    liveExecutionEnabled: false,
    decisions,
    systemRule:
      "Execution Ticket Paper Order Sync creates and fills paper orders from V16 execution tickets. Live trading remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
