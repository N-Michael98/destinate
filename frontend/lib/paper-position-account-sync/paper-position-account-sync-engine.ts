import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";

import {
  PaperAccountRiskMode,
  PaperPositionAccountSnapshot,
  PaperPositionAccountSyncReport,
} from "./paper-position-account-sync-types";

const VERSION = "V16.2.1" as const;

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function calculateExposureValue(position: {
  entry: number;
  size: number;
}) {
  return round(Math.abs(position.entry * position.size));
}

function calculateOpenRiskAmount(position: {
  entry: number;
  stopLoss: number;
  size: number;
}) {
  return round(Math.abs(position.entry - position.stopLoss) * position.size);
}

function calculateUsedMargin(totalExposureValue: number) {
  const paperLeverage = 20;
  return round(totalExposureValue / paperLeverage);
}

function calculatePercent(value: number, base: number) {
  if (base <= 0) return 0;
  return round((value / base) * 100);
}

function resolveRiskMode(params: {
  openRiskPercent: number;
  marginUsagePercent: number;
  openPositions: number;
}): PaperAccountRiskMode {
  if (params.marginUsagePercent >= 80 || params.openRiskPercent >= 10) {
    return "BLOCKED";
  }

  if (params.marginUsagePercent >= 60 || params.openRiskPercent >= 6) {
    return "HIGH_RISK";
  }

  if (params.marginUsagePercent >= 35 || params.openRiskPercent >= 3) {
    return "ELEVATED_RISK";
  }

  if (params.openPositions > 0) {
    return "NORMAL_RISK";
  }

  return "LOW_RISK";
}

function buildPositionSnapshot(
  position: ReturnType<typeof paperTradingManager.getPositions>[number]
): PaperPositionAccountSnapshot {
  const exposureValue = calculateExposureValue({
    entry: position.entry,
    size: position.size,
  });

  const openRiskAmount = calculateOpenRiskAmount({
    entry: position.entry,
    stopLoss: position.stopLoss,
    size: position.size,
  });

  return {
    id: position.id,
    symbol: position.symbol,
    direction: position.direction,
    entry: position.entry,
    currentPrice: position.currentPrice,
    stopLoss: position.stopLoss,
    size: position.size,
    exposureValue,
    openRiskAmount,
    unrealizedPnL: position.unrealizedPnL,
    status: position.status,
  };
}

export function generatePaperPositionAccountSyncReport():
  PaperPositionAccountSyncReport {
  const account = paperTradingManager.getAccount();

  const positions = paperTradingManager
    .getPositions()
    .filter((position) => position.status === "OPEN")
    .map(buildPositionSnapshot);

  const totalExposureValue = round(
    positions.reduce((sum, position) => sum + position.exposureValue, 0)
  );

  const totalOpenRiskAmount = round(
    positions.reduce((sum, position) => sum + position.openRiskAmount, 0)
  );

  const usedMargin = calculateUsedMargin(totalExposureValue);
  const freeMargin = round(account.equity - usedMargin);

  const exposurePercent = calculatePercent(totalExposureValue, account.equity);
  const openRiskPercent = calculatePercent(totalOpenRiskAmount, account.equity);
  const marginUsagePercent = calculatePercent(usedMargin, account.equity);

  const riskMode = resolveRiskMode({
    openRiskPercent,
    marginUsagePercent,
    openPositions: positions.length,
  });

  const recommendation =
    riskMode === "BLOCKED"
      ? "Paper account risk is blocked. Do not add more paper positions."
      : riskMode === "HIGH_RISK"
        ? "Paper account risk is high. Reduce exposure before opening new positions."
        : riskMode === "ELEVATED_RISK"
          ? "Paper account risk is elevated. Continue only with reduced paper position size."
          : riskMode === "NORMAL_RISK"
            ? "Paper account risk is normal. Continue monitoring exposure and open risk."
            : "No open paper position risk detected.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    accountCurrency: account.currency,
    balance: account.balance,
    equity: account.equity,
    realizedPnL: account.realizedPnL,
    unrealizedPnL: account.unrealizedPnL,
    openPositions: positions.length,
    totalExposureValue,
    totalOpenRiskAmount,
    exposurePercent,
    openRiskPercent,
    usedMargin,
    freeMargin,
    marginUsagePercent,
    riskMode,
    liveExecutionEnabled: false,
    positions,
    systemRule:
      "Paper Position Account Sync converts open V16 paper positions into account exposure, margin and risk metrics. Live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
