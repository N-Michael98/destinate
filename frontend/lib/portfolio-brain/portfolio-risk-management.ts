import { buildPortfolioBrainAdaptiveConfidenceReport } from "./portfolio-brain-adaptive-confidence";
import { buildPortfolioBrainSelfEvolutionReport } from "./portfolio-brain-self-evolution";

export type PortfolioRiskState =
  | "SAFE"
  | "NORMAL"
  | "CAUTIOUS"
  | "DEFENSIVE"
  | "LOCKDOWN";

export type PortfolioRiskManagementReport = {
  version: string;
  status: "READY";
  account: {
    currency: string;
    startEquityToday: number;
    currentEquity: number;
    dailyPnl: number;
    dailyLossPercent: number;
    dailyWarningLimitPercent: number;
    dailyHardStopLimitPercent: number;
  };
  risk: {
    riskState: PortfolioRiskState;
    tradingAllowed: boolean;
    newTradesAllowed: boolean;
    manageOpenPositionsAllowed: boolean;
    riskPerTradePercent: number;
    maxRiskPerTradeAmount: number;
    maxPortfolioExposurePercent: number;
    dailyLossLimitReached: boolean;
    dailyHardStopReached: boolean;
  };
  adaptiveInputs: {
    averageAdaptiveConfidence: number;
    totalConfidenceAdjustment: number;
    bestStrategyWeight: number;
    promotedStrategies: number;
    reducedStrategies: number;
  };
  executionRules: {
    unlimitedTradesUntilDailyLimit: boolean;
    requiresAnalysisGo: boolean;
    requiresPositiveRiskState: boolean;
    requiresExposureRoom: boolean;
    requiresDailyLossBelowHardStop: boolean;
  };
  recommendation: string;
  updatedAt: string;
};

function calculateRiskState(input: {
  dailyLossPercent: number;
  averageAdaptiveConfidence: number;
  bestStrategyWeight: number;
  reducedStrategies: number;
}): PortfolioRiskState {
  if (input.dailyLossPercent >= 5) return "LOCKDOWN";
  if (input.dailyLossPercent >= 3) return "DEFENSIVE";
  if (input.averageAdaptiveConfidence < 50) return "CAUTIOUS";
  if (input.reducedStrategies >= 2) return "CAUTIOUS";
  if (input.averageAdaptiveConfidence >= 65 && input.bestStrategyWeight >= 75) {
    return "SAFE";
  }
  return "NORMAL";
}

function calculateRiskPerTradePercent(riskState: PortfolioRiskState): number {
  if (riskState === "SAFE") return 1.25;
  if (riskState === "NORMAL") return 1;
  if (riskState === "CAUTIOUS") return 0.75;
  if (riskState === "DEFENSIVE") return 0.5;
  return 0;
}

function calculateMaxExposurePercent(riskState: PortfolioRiskState): number {
  if (riskState === "SAFE") return 25;
  if (riskState === "NORMAL") return 20;
  if (riskState === "CAUTIOUS") return 15;
  if (riskState === "DEFENSIVE") return 10;
  return 0;
}

function buildRecommendation(input: {
  riskState: PortfolioRiskState;
  dailyLossPercent: number;
  tradingAllowed: boolean;
  riskPerTradePercent: number;
  maxPortfolioExposurePercent: number;
}): string {
  if (input.riskState === "LOCKDOWN") {
    return "Daily hard stop reached. New trades are blocked. Manage existing positions only.";
  }

  if (input.riskState === "DEFENSIVE") {
    return `Daily warning zone reached at ${input.dailyLossPercent}%. New trades are allowed only with reduced risk and strong analysis confirmation.`;
  }

  if (!input.tradingAllowed) {
    return "Trading is blocked by portfolio risk management.";
  }

  return `Trading allowed under ${input.riskState} risk profile with ${input.riskPerTradePercent}% risk per trade and ${input.maxPortfolioExposurePercent}% max exposure.`;
}

export function buildPortfolioRiskManagementReport(): PortfolioRiskManagementReport {
  const adaptiveConfidence = buildPortfolioBrainAdaptiveConfidenceReport();
  const selfEvolution = buildPortfolioBrainSelfEvolutionReport();

  const startEquityToday = 10000;
  const currentEquity = 10000;
  const dailyPnl = currentEquity - startEquityToday;

  const dailyLossPercent =
    dailyPnl >= 0
      ? 0
      : Number((Math.abs(dailyPnl) / startEquityToday * 100).toFixed(2));

  const averageAdaptiveConfidence =
    adaptiveConfidence.averageAdaptiveConfidence ?? 0;

  const totalConfidenceAdjustment =
    adaptiveConfidence.totalAdjustment ?? 0;

  const bestStrategyWeight =
    selfEvolution.bestStrategy?.weight ?? 0;

  const promotedStrategies =
    selfEvolution.promotedStrategies ?? 0;

  const reducedStrategies =
    selfEvolution.reducedStrategies ?? 0;

  const riskState = calculateRiskState({
    dailyLossPercent,
    averageAdaptiveConfidence,
    bestStrategyWeight,
    reducedStrategies,
  });

  const riskPerTradePercent = calculateRiskPerTradePercent(riskState);
  const maxPortfolioExposurePercent = calculateMaxExposurePercent(riskState);

  const dailyLossLimitReached = dailyLossPercent >= 3;
  const dailyHardStopReached = dailyLossPercent >= 5;

  const tradingAllowed = riskState !== "LOCKDOWN" && !dailyHardStopReached;
  const newTradesAllowed = tradingAllowed;
  const manageOpenPositionsAllowed = true;

  const maxRiskPerTradeAmount = Number(
    ((currentEquity * riskPerTradePercent) / 100).toFixed(2)
  );

  return {
    version: "V11.6.1",
    status: "READY",
    account: {
      currency: "CHF",
      startEquityToday,
      currentEquity,
      dailyPnl,
      dailyLossPercent,
      dailyWarningLimitPercent: 3,
      dailyHardStopLimitPercent: 5,
    },
    risk: {
      riskState,
      tradingAllowed,
      newTradesAllowed,
      manageOpenPositionsAllowed,
      riskPerTradePercent,
      maxRiskPerTradeAmount,
      maxPortfolioExposurePercent,
      dailyLossLimitReached,
      dailyHardStopReached,
    },
    adaptiveInputs: {
      averageAdaptiveConfidence,
      totalConfidenceAdjustment,
      bestStrategyWeight,
      promotedStrategies,
      reducedStrategies,
    },
    executionRules: {
      unlimitedTradesUntilDailyLimit: true,
      requiresAnalysisGo: true,
      requiresPositiveRiskState: true,
      requiresExposureRoom: true,
      requiresDailyLossBelowHardStop: true,
    },
    recommendation: buildRecommendation({
      riskState,
      dailyLossPercent,
      tradingAllowed,
      riskPerTradePercent,
      maxPortfolioExposurePercent,
    }),
    updatedAt: new Date().toISOString(),
  };
}