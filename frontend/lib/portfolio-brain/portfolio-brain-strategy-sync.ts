import { buildStrategyOpportunitySyncReport } from "@/lib/market-universe/strategy-opportunity-sync";

export type PortfolioBrainStrategyDecision = {
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  executionBias: string;
  approved: boolean;
  reason: string;
};

export type PortfolioBrainStrategySyncReport = {
  version: string;
  status: "READY";
  totalStrategies: number;
  approvedStrategies: number;
  bestDecision: PortfolioBrainStrategyDecision | null;
  decisions: PortfolioBrainStrategyDecision[];
  recommendation: string;
  updatedAt: string;
};

function buildDecision(match: any): PortfolioBrainStrategyDecision {
  const approved =
    match.executionBias !== "WAIT" &&
    match.confidence >= 55;

  return {
    symbol: match.symbol,
    strategy: match.selectedStrategy,
    direction: match.direction,
    confidence: match.confidence,
    executionBias: match.executionBias,
    approved,
    reason: approved
      ? `${match.symbol} approved by Portfolio Brain using ${match.selectedStrategy}.`
      : `${match.symbol} rejected because confidence/execution requirements were not met.`,
  };
}

export function buildPortfolioBrainStrategySyncReport(): PortfolioBrainStrategySyncReport {
  const strategySync = buildStrategyOpportunitySyncReport();

  const decisions = strategySync.matches.map(buildDecision);

  const approvedStrategies = decisions.filter(
    (decision) => decision.approved
  ).length;

  const bestDecision =
    decisions.find((decision) => decision.approved) ?? null;

  return {
    version: "V11.5.1",
    status: "READY",
    totalStrategies: decisions.length,
    approvedStrategies,
    bestDecision,
    decisions,
    recommendation:
      bestDecision === null
        ? "No approved strategy available."
        : `${bestDecision.symbol} selected as primary Portfolio Brain candidate.`,
    updatedAt: new Date().toISOString(),
  };
}