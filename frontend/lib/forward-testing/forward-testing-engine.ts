import { generateExecutionPositionTicketSyncReport } from "@/lib/execution-position-ticket-sync";

import {
  ForwardTestingReport,
  ForwardTestResult,
  ForwardTestSignal,
  ForwardTestingMetrics,
  ForwardTestOutcome,
} from "./forward-testing-types";

const VERSION = "V16.4.0" as const;

function round2(v: number) { return Math.round(v * 100) / 100; }
function round4(v: number) { return Math.round(v * 10000) / 10000; }

const BASE_PRICES: Record<string, number> = {
  XAUUSD: 3372,
  EURUSD: 1.0842,
  NAS100: 19250,
  USOIL: 78.4,
  BTCUSD: 68250,
  SPX500: 5400,
};

const RISK_DISTANCES: Record<string, number> = {
  XAUUSD: 15,
  EURUSD: 0.006,
  NAS100: 80,
  USOIL: 0.8,
  BTCUSD: 900,
  SPX500: 25,
};

function getBase(symbol: string) { return BASE_PRICES[symbol] ?? 100; }
function getRisk(symbol: string) { return RISK_DISTANCES[symbol] ?? 1; }

function buildSignal(ticket: ReturnType<typeof generateExecutionPositionTicketSyncReport>["tickets"][number], idx: number): ForwardTestSignal {
  const base = getBase(ticket.symbol);
  const riskDist = getRisk(ticket.symbol);
  const entry = ticket.side === "BUY" ? base : base;
  const stopLoss = ticket.side === "BUY" ? round4(entry - riskDist) : round4(entry + riskDist);
  const takeProfit = ticket.side === "BUY" ? round4(entry + riskDist * 2) : round4(entry - riskDist * 2);

  return {
    signalId: `FT-SIG-${ticket.symbol}-${String(idx + 1).padStart(3, "0")}`,
    symbol: ticket.symbol,
    side: ticket.side as "BUY" | "SELL",
    tradingStyle: ticket.tradingStyle,
    confidenceScore: ticket.confidenceScore,
    evolvedLotSize: ticket.evolvedAllocatedLots,
    entryPrice: entry,
    stopLoss,
    takeProfit,
    riskPercent: ticket.riskPercent,
    expectedRR: 2.0,
    generatedAt: new Date().toISOString(),
  };
}

function simulateOutcome(signal: ForwardTestSignal, idx: number): ForwardTestResult {
  // Deterministic simulation based on confidence score
  const seed = (signal.confidenceScore + idx * 7) % 100;
  const winProb = signal.confidenceScore / 100;
  const isWin = seed / 100 < winProb;
  const isBreakeven = !isWin && seed > 90;

  const riskDist = getRisk(signal.symbol);
  const slippage = round4(riskDist * 0.005);

  let exitPrice: number;
  let outcome: ForwardTestOutcome;
  let actualRR: number;
  let pnlPercent: number;
  let hitTarget: boolean;
  let hitStop: boolean;

  if (isBreakeven) {
    exitPrice = round4(signal.entryPrice + slippage);
    outcome = "BREAKEVEN";
    actualRR = 0;
    pnlPercent = 0;
    hitTarget = false;
    hitStop = false;
  } else if (isWin) {
    exitPrice = signal.takeProfit;
    outcome = "WIN";
    actualRR = round2(signal.expectedRR - 0.1 + (seed % 3) * 0.05);
    pnlPercent = round2(signal.riskPercent * actualRR);
    hitTarget = true;
    hitStop = false;
  } else {
    exitPrice = signal.stopLoss;
    outcome = "LOSS";
    actualRR = round2(-1 + (seed % 5) * 0.05);
    pnlPercent = round2(-signal.riskPercent);
    hitTarget = false;
    hitStop = true;
  }

  return {
    resultId: `FT-RES-${signal.symbol}-${signal.signalId.slice(-3)}`,
    signalId: signal.signalId,
    symbol: signal.symbol,
    side: signal.side,
    tradingStyle: signal.tradingStyle,
    confidenceScore: signal.confidenceScore,
    evolvedLotSize: signal.evolvedLotSize,
    entryPrice: signal.entryPrice,
    exitPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    riskPercent: signal.riskPercent,
    actualRR,
    expectedRR: signal.expectedRR,
    pnlPercent,
    outcome,
    hitTarget,
    hitStop,
    barsHeld: Math.max(1, Math.round(signal.confidenceScore / 10) + (seed % 5)),
    slippagePercent: round4(slippage / signal.entryPrice * 100),
    note: `Walk-forward simulation: ${outcome} — Confidence ${signal.confidenceScore}% | Evolved ${signal.evolvedLotSize} lots`,
  };
}

function buildMetrics(signals: ForwardTestSignal[], results: ForwardTestResult[]): ForwardTestingMetrics {
  const wins = results.filter((r) => r.outcome === "WIN").length;
  const losses = results.filter((r) => r.outcome === "LOSS").length;
  const breakevens = results.filter((r) => r.outcome === "BREAKEVEN").length;
  const completed = results.length;
  const winRate = completed > 0 ? round2((wins / completed) * 100) : 0;

  const totalProfit = results.filter((r) => r.pnlPercent > 0).reduce((s, r) => s + r.pnlPercent, 0);
  const totalLoss = Math.abs(results.filter((r) => r.pnlPercent < 0).reduce((s, r) => s + r.pnlPercent, 0));
  const profitFactor = totalLoss > 0 ? round2(totalProfit / totalLoss) : totalProfit > 0 ? 99 : 0;

  const avgRR = completed > 0 ? round2(results.reduce((s, r) => s + r.actualRR, 0) / completed) : 0;
  const totalPnlPercent = round2(results.reduce((s, r) => s + r.pnlPercent, 0));
  const expectedValuePerTrade = completed > 0 ? round2(totalPnlPercent / completed) : 0;
  const avgConfidence = signals.length > 0 ? round2(signals.reduce((s, sig) => s + sig.confidenceScore, 0) / signals.length) : 0;
  const avgLots = signals.length > 0 ? round2(signals.reduce((s, sig) => s + sig.evolvedLotSize, 0) / signals.length) : 0;

  const best = results.reduce((b, r) => r.pnlPercent > b.pnlPercent ? r : b, results[0]);
  const worst = results.reduce((b, r) => r.pnlPercent < b.pnlPercent ? r : b, results[0]);

  return {
    totalSignals: signals.length,
    completedTrades: completed,
    pendingTrades: signals.length - completed,
    wins,
    losses,
    breakevens,
    winRate,
    avgRR,
    profitFactor,
    expectedValuePerTrade,
    totalPnlPercent,
    avgConfidenceScore: avgConfidence,
    avgEvolvedLotSize: avgLots,
    bestTrade: best ? `${best.symbol} +${best.pnlPercent}%` : "—",
    worstTrade: worst ? `${worst.symbol} ${worst.pnlPercent}%` : "—",
  };
}

export function generateForwardTestingReport(): ForwardTestingReport {
  const ticketReport = generateExecutionPositionTicketSyncReport();

  const readyTickets = ticketReport.tickets.filter((t) => t.ticketStatus === "READY" && t.side !== "NONE");

  const signals = readyTickets.map(buildSignal);
  const results = signals.map(simulateOutcome);
  const metrics = buildMetrics(signals, results);

  const status = signals.length === 0 ? "WAITING_FOR_DATA" : "RUNNING";

  return {
    version: VERSION,
    status,
    mode: "FORWARD_TEST",
    sessionId: `FT-SESSION-${Date.now().toString(36).toUpperCase()}`,
    signals,
    results,
    metrics,
    loopSource: "V16.3.1 Execution Position Ticket Sync → V16.4.0 Forward Testing",
    summary:
      `Forward Testing V16.4.0 ran walk-forward simulation on ${signals.length} evolved execution signals. ` +
      `Win Rate: ${metrics.winRate}% | Profit Factor: ${metrics.profitFactor} | Avg RR: ${metrics.avgRR} | Total PnL: ${metrics.totalPnlPercent}%.`,
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      forwardTestMode: "WALK_FORWARD_SIMULATION",
    },
    createdAt: new Date().toISOString(),
  };
}
