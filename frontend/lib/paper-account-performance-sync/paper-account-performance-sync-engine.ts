import { generatePaperPositionAccountSyncReport } from "@/lib/paper-position-account-sync";
import { PaperHistory } from "@/lib/paper-trading/paper-history";

import {
  PaperAccountPerformanceSyncReport,
  PaperPerformanceRiskGrade,
} from "./paper-account-performance-sync-types";

const VERSION = "V16.2.2" as const;

type HistoryEvent = {
  id: string;
  type: string;
  entity: string;
  event: string;
  timestamp: string;
  payload: any;
};

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function safePercent(value: number, base: number) {
  if (base <= 0) return 0;
  return round((value / base) * 100);
}

function calculateProfitFactor(wins: number[], losses: number[]) {
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));

  if (grossLoss === 0) {
    return grossProfit > 0 ? 999 : 0;
  }

  return round(grossProfit / grossLoss);
}

function calculatePerformanceScore(params: {
  returnPercent: number;
  winRate: number;
  profitFactor: number;
  openRiskPercent: number;
  marginUsagePercent: number;
}) {
  const profitFactorScore = Math.min(params.profitFactor, 3) * 15;

  const raw =
    50 +
    params.returnPercent * 4 +
    params.winRate * 0.25 +
    profitFactorScore -
    params.openRiskPercent * 2 -
    params.marginUsagePercent * 0.35;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function resolveRiskGrade(score: number): PaperPerformanceRiskGrade {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "NEUTRAL";
  if (score >= 30) return "WEAK";
  return "BLOCKED";
}

function buildRecommendation(grade: PaperPerformanceRiskGrade) {
  if (grade === "EXCELLENT") {
    return "Paper performance is excellent. Continue controlled paper execution and monitor risk limits.";
  }

  if (grade === "GOOD") {
    return "Paper performance is good. Continue paper trading with normal risk controls.";
  }

  if (grade === "NEUTRAL") {
    return "Paper performance is neutral. Keep execution conservative until more outcomes are available.";
  }

  if (grade === "WEAK") {
    return "Paper performance is weak. Reduce paper position size and wait for stronger confirmation.";
  }

  return "Paper performance is blocked. Stop new paper execution until risk improves.";
}

export function generatePaperAccountPerformanceSyncReport():
  PaperAccountPerformanceSyncReport {
  const account = generatePaperPositionAccountSyncReport();
  const history = PaperHistory.getAll() as HistoryEvent[];

  const orderCreatedEvents = history.filter(
    (item) => item.type === "ORDER_CREATED"
  );

  const orderFilledEvents = history.filter(
    (item) => item.type === "ORDER_FILLED"
  );

  const positionOpenedEvents = history.filter(
    (item) => item.type === "POSITION_OPENED"
  );

  const positionUpdatedEvents = history.filter(
    (item) => item.type === "POSITION_UPDATED"
  );

  const positionClosedEvents = history.filter(
    (item) => item.type === "POSITION_CLOSED"
  );

  const closedPnls = positionClosedEvents.map((item) =>
    Number(item.payload?.unrealizedPnL ?? item.payload?.realizedPnL ?? 0)
  );

  const updatedPnls = positionUpdatedEvents.map((item) =>
    Number(item.payload?.unrealizedPnL ?? 0)
  );

  const pnlSamples = closedPnls.length > 0 ? closedPnls : updatedPnls;

  const winningPnls = pnlSamples.filter((value) => value > 0);
  const losingPnls = pnlSamples.filter((value) => value < 0);
  const breakevenPnls = pnlSamples.filter((value) => value === 0);

  const totalTrades = orderFilledEvents.length;
  const winningTrades = winningPnls.length;
  const losingTrades = losingPnls.length;
  const breakevenTrades = breakevenPnls.length;

  const winRate =
    pnlSamples.length === 0 ? 0 : safePercent(winningTrades, pnlSamples.length);

  const lossRate =
    pnlSamples.length === 0 ? 0 : safePercent(losingTrades, pnlSamples.length);

  const profitFactor = calculateProfitFactor(winningPnls, losingPnls);

  const averagePnL =
    pnlSamples.length === 0
      ? 0
      : round(pnlSamples.reduce((sum, value) => sum + value, 0) / pnlSamples.length);

  const bestPnL = pnlSamples.length === 0 ? 0 : Math.max(...pnlSamples);
  const worstPnL = pnlSamples.length === 0 ? 0 : Math.min(...pnlSamples);

  const netPnL = round(account.realizedPnL + account.unrealizedPnL);
  const returnPercent = safePercent(netPnL, account.accountBalance);

  const performanceScore = calculatePerformanceScore({
    returnPercent,
    winRate,
    profitFactor,
    openRiskPercent: account.openRiskPercent,
    marginUsagePercent: account.marginUsagePercent,
  });

  const riskGrade = resolveRiskGrade(performanceScore);

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",

    accountBalance: account.balance,
    accountEquity: account.equity,
    realizedPnL: account.realizedPnL,
    unrealizedPnL: account.unrealizedPnL,
    netPnL,
    returnPercent,

    openPositions: account.openPositions,
    totalExposureValue: account.totalExposureValue,
    totalOpenRiskAmount: account.totalOpenRiskAmount,
    exposurePercent: account.exposurePercent,
    openRiskPercent: account.openRiskPercent,
    usedMargin: account.usedMargin,
    freeMargin: account.freeMargin,
    marginUsagePercent: account.marginUsagePercent,

    totalHistoryEvents: history.length,
    orderCreatedEvents: orderCreatedEvents.length,
    orderFilledEvents: orderFilledEvents.length,
    positionOpenedEvents: positionOpenedEvents.length,
    positionUpdatedEvents: positionUpdatedEvents.length,
    positionClosedEvents: positionClosedEvents.length,

    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    lossRate,
    profitFactor,
    averagePnL,
    bestPnL,
    worstPnL,

    performanceScore,
    riskGrade,
    liveExecutionEnabled: false,

    systemRule:
      "Paper Account Performance Sync converts V16 paper account and history data into performance metrics. Live execution remains disabled.",
    recommendation: buildRecommendation(riskGrade),
    updatedAt: new Date().toISOString(),
  };
}
