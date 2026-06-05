import { getPortfolioBrainMemory } from "./portfolio-brain-memory";

export type PortfolioBrainOutcomeType = "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";

export type PortfolioBrainOutcomeEntry = {
  id: string;
  memoryId: string;
  createdAt: string;
  decision: string;
  confidence: number;
  riskScore: number;
  outcome: PortfolioBrainOutcomeType;
  pnlPercent: number;
  reason: string;
};

export type PortfolioBrainOutcomeReport = {
  version: string;
  status: "READY";
  totalOutcomes: number;
  wins: number;
  losses: number;
  breakevens: number;
  openOutcomes: number;
  winRate: number;
  averagePnlPercent: number;
  bestDecisionType: string;
  worstDecisionType: string;
  outcomeQualityScore: number;
  recommendation: string;
  outcomes: PortfolioBrainOutcomeEntry[];
  updatedAt: string;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateWinRate(wins: number, losses: number, breakevens: number): number {
  const closed = wins + losses + breakevens;
  if (closed === 0) return 0;
  return Math.round((wins / closed) * 100);
}

function generateMockOutcome(
  decision: string,
  confidence: number,
  riskScore: number
): {
  outcome: PortfolioBrainOutcomeType;
  pnlPercent: number;
  reason: string;
} {
  if (decision === "WAIT" || decision === "BLOCK") {
    return {
      outcome: "OPEN",
      pnlPercent: 0,
      reason: "No trade execution because Portfolio Brain recommended waiting or blocking.",
    };
  }

  if (confidence >= 75 && riskScore <= 45) {
    return {
      outcome: "WIN",
      pnlPercent: 1.25,
      reason: "High confidence and controlled risk produced a simulated positive outcome.",
    };
  }

  if (riskScore >= 70) {
    return {
      outcome: "LOSS",
      pnlPercent: -0.85,
      reason: "Elevated risk produced a simulated negative outcome.",
    };
  }

  return {
    outcome: "BREAKEVEN",
    pnlPercent: 0,
    reason: "Mixed confidence and risk produced a simulated breakeven outcome.",
  };
}

function buildOutcomeEntries(): PortfolioBrainOutcomeEntry[] {
  const memory = getPortfolioBrainMemory();

  return memory.map((entry) => {
    const mock = generateMockOutcome(
      entry.decision,
      entry.confidence,
      entry.riskScore
    );

    return {
      id: `portfolio-brain-outcome-${entry.id}`,
      memoryId: entry.id,
      createdAt: new Date().toISOString(),
      decision: entry.decision,
      confidence: entry.confidence,
      riskScore: entry.riskScore,
      outcome: mock.outcome,
      pnlPercent: mock.pnlPercent,
      reason: mock.reason,
    };
  });
}

function getDecisionAveragePnl(
  outcomes: PortfolioBrainOutcomeEntry[],
  decision: string
): number {
  const filtered = outcomes.filter((entry) => entry.decision === decision);
  if (filtered.length === 0) return 0;

  return round(
    filtered.reduce((sum, entry) => sum + entry.pnlPercent, 0) /
      filtered.length
  );
}

export function buildPortfolioBrainOutcomeReport(): PortfolioBrainOutcomeReport {
  const outcomes = buildOutcomeEntries();

  const wins = outcomes.filter((entry) => entry.outcome === "WIN").length;
  const losses = outcomes.filter((entry) => entry.outcome === "LOSS").length;
  const breakevens = outcomes.filter((entry) => entry.outcome === "BREAKEVEN").length;
  const openOutcomes = outcomes.filter((entry) => entry.outcome === "OPEN").length;

  const averagePnlPercent =
    outcomes.length === 0
      ? 0
      : round(
          outcomes.reduce((sum, entry) => sum + entry.pnlPercent, 0) /
            outcomes.length
        );

  const winRate = calculateWinRate(wins, losses, breakevens);

  const decisions = ["WAIT", "LONG", "SHORT", "BLOCK"];

  const decisionPnl = decisions.map((decision) => ({
    decision,
    averagePnl: getDecisionAveragePnl(outcomes, decision),
  }));

  const decisionsWithData = decisionPnl.filter((item) =>
    outcomes.some((entry) => entry.decision === item.decision)
  );

  const bestDecisionType =
    [...decisionsWithData].sort((a, b) => b.averagePnl - a.averagePnl)[0]
      ?.decision ?? "UNKNOWN";

  const worstDecisionType =
    [...decisionsWithData].sort((a, b) => a.averagePnl - b.averagePnl)[0]
      ?.decision ?? "UNKNOWN";

  const outcomeQualityScore = Math.max(
    0,
    Math.min(100, 50 + winRate / 2 + averagePnlPercent * 10 - openOutcomes * 3)
  );

  const recommendation =
    outcomes.length === 0
      ? "Portfolio Brain needs memory entries before outcome tracking can evaluate results."
      : openOutcomes === outcomes.length
        ? "Most Portfolio Brain decisions are WAIT or BLOCK. Outcome tracking is active, but trade-result learning needs executed LONG or SHORT decisions."
        : outcomeQualityScore >= 75
          ? "Portfolio Brain outcomes are strong. Continue collecting simulated results before enabling adaptive live logic."
          : outcomeQualityScore >= 50
            ? "Portfolio Brain outcomes are stable but need more samples before increasing confidence."
            : "Portfolio Brain outcomes are weak or incomplete. Keep simulation mode active and collect more observations.";

  return {
    version: "V11.4.2",
    status: "READY",
    totalOutcomes: outcomes.length,
    wins,
    losses,
    breakevens,
    openOutcomes,
    winRate,
    averagePnlPercent,
    bestDecisionType,
    worstDecisionType,
    outcomeQualityScore: Math.round(outcomeQualityScore),
    recommendation,
    outcomes,
    updatedAt: new Date().toISOString(),
  };
}