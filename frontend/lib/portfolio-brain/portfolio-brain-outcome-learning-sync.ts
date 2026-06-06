import { buildPortfolioBrainDecisionMemoryReport } from "./portfolio-brain-decision-memory";

export type PortfolioBrainOutcomeLearningItem = {
  id: string;
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  approved: boolean;
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "NO_TRADE";
  simulatedPnlPercent: number;
  learningImpact: "BOOST" | "PENALTY" | "NEUTRAL";
  confidenceAdjustment: number;
  reason: string;
};

export type PortfolioBrainOutcomeLearningSyncReport = {
  version: string;
  status: "READY";
  totalMemories: number;
  approvedMemories: number;
  rejectedMemories: number;
  wins: number;
  losses: number;
  breakevens: number;
  noTrades: number;
  winRate: number;
  averagePnlPercent: number;
  totalConfidenceAdjustment: number;
  learningState: "IMPROVING" | "CAUTIOUS" | "NEUTRAL";
  bestLearningItem: PortfolioBrainOutcomeLearningItem | null;
  worstLearningItem: PortfolioBrainOutcomeLearningItem | null;
  items: PortfolioBrainOutcomeLearningItem[];
  recommendation: string;
  updatedAt: string;
};

function simulateOutcome(input: {
  approved: boolean;
  confidence: number;
  direction: string;
  symbol: string;
}): {
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "NO_TRADE";
  simulatedPnlPercent: number;
} {
  if (!input.approved || input.direction === "WAIT") {
    return {
      simulatedOutcome: "NO_TRADE",
      simulatedPnlPercent: 0,
    };
  }

  if (input.confidence >= 65) {
    return {
      simulatedOutcome: "WIN",
      simulatedPnlPercent: 2.4,
    };
  }

  if (input.confidence >= 55) {
    return {
      simulatedOutcome: "BREAKEVEN",
      simulatedPnlPercent: 0.2,
    };
  }

  return {
    simulatedOutcome: "LOSS",
    simulatedPnlPercent: -1.4,
  };
}

function calculateLearningImpact(input: {
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "NO_TRADE";
  approved: boolean;
}): {
  learningImpact: "BOOST" | "PENALTY" | "NEUTRAL";
  confidenceAdjustment: number;
} {
  if (!input.approved || input.simulatedOutcome === "NO_TRADE") {
    return {
      learningImpact: "NEUTRAL",
      confidenceAdjustment: 0,
    };
  }

  if (input.simulatedOutcome === "WIN") {
    return {
      learningImpact: "BOOST",
      confidenceAdjustment: 4,
    };
  }

  if (input.simulatedOutcome === "LOSS") {
    return {
      learningImpact: "PENALTY",
      confidenceAdjustment: -5,
    };
  }

  return {
    learningImpact: "NEUTRAL",
    confidenceAdjustment: 1,
  };
}

export function buildPortfolioBrainOutcomeLearningSyncReport(): PortfolioBrainOutcomeLearningSyncReport {
  const memoryReport = buildPortfolioBrainDecisionMemoryReport();

  const items = memoryReport.memory.map((entry) => {
    const outcome = simulateOutcome({
      approved: entry.approved,
      confidence: entry.confidence,
      direction: entry.direction,
      symbol: entry.symbol,
    });

    const impact = calculateLearningImpact({
      simulatedOutcome: outcome.simulatedOutcome,
      approved: entry.approved,
    });

    return {
      id: entry.id,
      symbol: entry.symbol,
      strategy: entry.strategy,
      direction: entry.direction,
      confidence: entry.confidence,
      approved: entry.approved,
      simulatedOutcome: outcome.simulatedOutcome,
      simulatedPnlPercent: outcome.simulatedPnlPercent,
      learningImpact: impact.learningImpact,
      confidenceAdjustment: impact.confidenceAdjustment,
      reason: `${entry.symbol} produced ${outcome.simulatedOutcome} with ${outcome.simulatedPnlPercent}% simulated PnL. Learning impact: ${impact.learningImpact}.`,
    };
  });

  const wins = items.filter((item) => item.simulatedOutcome === "WIN").length;
  const losses = items.filter((item) => item.simulatedOutcome === "LOSS").length;
  const breakevens = items.filter((item) => item.simulatedOutcome === "BREAKEVEN").length;
  const noTrades = items.filter((item) => item.simulatedOutcome === "NO_TRADE").length;

  const closed = wins + losses + breakevens;

  const winRate =
    closed === 0 ? 0 : Math.round((wins / closed) * 100);

  const averagePnlPercent =
    closed === 0
      ? 0
      : Number(
          (
            items
              .filter((item) => item.simulatedOutcome !== "NO_TRADE")
              .reduce((sum, item) => sum + item.simulatedPnlPercent, 0) / closed
          ).toFixed(2)
        );

  const totalConfidenceAdjustment = items.reduce(
    (sum, item) => sum + item.confidenceAdjustment,
    0
  );

  const learningState =
    totalConfidenceAdjustment > 3
      ? "IMPROVING"
      : totalConfidenceAdjustment < 0
        ? "CAUTIOUS"
        : "NEUTRAL";

  const tradableItems = items.filter((item) => item.simulatedOutcome !== "NO_TRADE");

  const bestLearningItem =
    tradableItems.length === 0
      ? null
      : [...tradableItems].sort(
          (a, b) => b.simulatedPnlPercent - a.simulatedPnlPercent
        )[0];

  const worstLearningItem =
    tradableItems.length === 0
      ? null
      : [...tradableItems].sort(
          (a, b) => a.simulatedPnlPercent - b.simulatedPnlPercent
        )[0];

  const recommendation =
    items.length === 0
      ? "No decision memories available for outcome learning yet."
      : learningState === "IMPROVING"
        ? "Portfolio Brain outcome learning is improving. Successful strategy decisions can receive confidence boosts."
        : learningState === "CAUTIOUS"
          ? "Portfolio Brain outcome learning is cautious. Losses or weak outcomes should reduce future confidence."
          : "Portfolio Brain outcome learning is neutral. Continue collecting decision outcomes.";

  return {
    version: "V11.5.5",
    status: "READY",
    totalMemories: memoryReport.totalDecisionMemories,
    approvedMemories: memoryReport.approvedMemories,
    rejectedMemories: memoryReport.rejectedMemories,
    wins,
    losses,
    breakevens,
    noTrades,
    winRate,
    averagePnlPercent,
    totalConfidenceAdjustment,
    learningState,
    bestLearningItem,
    worstLearningItem,
    items,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}