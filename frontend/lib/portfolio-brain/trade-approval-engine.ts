import { buildPortfolioBrainStrategySyncReport } from "./portfolio-brain-strategy-sync";
import { buildPortfolioBrainAdaptiveConfidenceReport } from "./portfolio-brain-adaptive-confidence";
import { buildPortfolioBrainSelfEvolutionReport } from "./portfolio-brain-self-evolution";
import { buildPortfolioRiskManagementReport } from "./portfolio-risk-management";

export type TradeApprovalStatus = "APPROVED" | "REJECTED";

export type TradeApprovalDecision = {
  symbol: string;
  strategy: string;
  direction: string;
  baseConfidence: number;
  adaptiveConfidence: number;
  strategyWeight: number;
  riskState: string;
  riskPerTradePercent: number;
  maxRiskAmount: number;
  approved: boolean;
  status: TradeApprovalStatus;
  rejectionReasons: string[];
  approvalReason: string;
};

export type TradeApprovalEngineReport = {
  version: string;
  status: "READY";
  totalCandidates: number;
  approvedTrades: number;
  rejectedTrades: number;
  bestApprovedTrade: TradeApprovalDecision | null;
  decisions: TradeApprovalDecision[];
  globalTradingAllowed: boolean;
  recommendation: string;
  updatedAt: string;
};

function buildRejectionReasons(input: {
  direction: string;
  portfolioApproved: boolean;
  adaptiveConfidence: number;
  confidenceState: string;
  strategyWeight: number;
  tradingAllowed: boolean;
  newTradesAllowed: boolean;
  dailyHardStopReached: boolean;
  riskState: string;
}): string[] {
  const reasons: string[] = [];

  if (!input.tradingAllowed) reasons.push("Global trading is blocked by portfolio risk management.");
  if (!input.newTradesAllowed) reasons.push("New trades are blocked by portfolio risk management.");
  if (input.dailyHardStopReached) reasons.push("Daily hard stop reached.");
  if (!input.portfolioApproved) reasons.push("Portfolio Brain did not approve this candidate.");
  if (input.direction === "WAIT") reasons.push("Direction is WAIT.");
  if (input.adaptiveConfidence < 60) reasons.push("Adaptive confidence below 60%.");
  if (input.confidenceState === "WAIT") reasons.push("Adaptive confidence state is WAIT.");
  if (input.strategyWeight < 50) reasons.push("Strategy self-evolution weight below 50.");
  if (input.riskState === "LOCKDOWN") reasons.push("Risk state is LOCKDOWN.");

  return reasons;
}

export function buildTradeApprovalEngineReport(): TradeApprovalEngineReport {
  const strategySync = buildPortfolioBrainStrategySyncReport();
  const adaptiveConfidence = buildPortfolioBrainAdaptiveConfidenceReport();
  const selfEvolution = buildPortfolioBrainSelfEvolutionReport();
  const riskManagement = buildPortfolioRiskManagementReport();

  const decisions: TradeApprovalDecision[] = strategySync.decisions.map((candidate) => {
    const adaptiveItem = adaptiveConfidence.items.find(
      (item) => item.symbol === candidate.symbol
    );

    const strategyItem = selfEvolution.strategies.find(
      (item) => item.strategy === candidate.strategy
    );

    const adaptiveValue = adaptiveItem?.adaptiveConfidence ?? candidate.confidence;
    const confidenceState = adaptiveItem?.confidenceState ?? "WAIT";
    const strategyWeight = strategyItem?.weight ?? 0;

    const rejectionReasons = buildRejectionReasons({
      direction: candidate.direction,
      portfolioApproved: candidate.approved,
      adaptiveConfidence: adaptiveValue,
      confidenceState,
      strategyWeight,
      tradingAllowed: riskManagement.risk.tradingAllowed,
      newTradesAllowed: riskManagement.risk.newTradesAllowed,
      dailyHardStopReached: riskManagement.risk.dailyHardStopReached,
      riskState: riskManagement.risk.riskState,
    });

    const approved = rejectionReasons.length === 0;
    const status: TradeApprovalStatus = approved ? "APPROVED" : "REJECTED";

    return {
      symbol: candidate.symbol,
      strategy: candidate.strategy,
      direction: candidate.direction,
      baseConfidence: candidate.confidence,
      adaptiveConfidence: adaptiveValue,
      strategyWeight,
      riskState: riskManagement.risk.riskState,
      riskPerTradePercent: riskManagement.risk.riskPerTradePercent,
      maxRiskAmount: riskManagement.risk.maxRiskPerTradeAmount,
      approved,
      status,
      rejectionReasons,
      approvalReason: approved
        ? `${candidate.symbol} approved by Trade Approval Engine with ${adaptiveValue}% adaptive confidence, strategy weight ${strategyWeight}, and ${riskManagement.risk.riskPerTradePercent}% risk per trade.`
        : "Trade rejected by Trade Approval Engine.",
    };
  });

  const approvedCandidates = decisions.filter((decision) => decision.approved);
  const approvedTrades = approvedCandidates.length;
  const rejectedTrades = decisions.length - approvedTrades;

  const bestApprovedTrade =
    approvedCandidates.length === 0
      ? null
      : [...approvedCandidates].sort(
          (a, b) =>
            b.adaptiveConfidence + b.strategyWeight -
            (a.adaptiveConfidence + a.strategyWeight)
        )[0];

  const recommendation =
    bestApprovedTrade === null
      ? "No trade approved. Continue scanning and wait for stronger confirmation."
      : `${bestApprovedTrade.symbol} is approved as the strongest trade candidate with ${bestApprovedTrade.adaptiveConfidence}% adaptive confidence.`;

  return {
    version: "V11.6.3",
    status: "READY",
    totalCandidates: decisions.length,
    approvedTrades,
    rejectedTrades,
    bestApprovedTrade,
    decisions,
    globalTradingAllowed: riskManagement.risk.tradingAllowed,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
