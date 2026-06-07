import { buildPaperTradingExecutionReport } from "./paper-trading-execution-engine";

export type TradeOutcomeFeedbackType =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL";

export type TradeOutcomeFeedbackItem = {
  id: string;
  sourceExecutionId: string;
  symbol: string;
  strategy: string;
  direction: string;
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  pnlAmount: number;
  pnlPercent: number;
  confidenceImpact: number;
  strategyImpact: number;
  feedbackType: TradeOutcomeFeedbackType;
  shouldBoostStrategy: boolean;
  shouldReduceStrategy: boolean;
  reason: string;
  createdAt: string;
};

export type TradeOutcomeFeedbackReport = {
  version: string;
  status: "READY";
  totalFeedbackItems: number;
  positiveFeedback: number;
  negativeFeedback: number;
  neutralFeedback: number;
  totalPnlAmount: number;
  averagePnlPercent: number;
  totalConfidenceImpact: number;
  totalStrategyImpact: number;
  bestFeedbackItem: TradeOutcomeFeedbackItem | null;
  worstFeedbackItem: TradeOutcomeFeedbackItem | null;
  feedback: TradeOutcomeFeedbackItem[];
  recommendation: string;
  updatedAt: string;
};

function createFeedbackId(symbol: string): string {
  return `trade-feedback-${symbol.toLowerCase()}-${Date.now()}`;
}

function calculateFeedback(input: {
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  pnlPercent: number;
}): {
  feedbackType: TradeOutcomeFeedbackType;
  confidenceImpact: number;
  strategyImpact: number;
  shouldBoostStrategy: boolean;
  shouldReduceStrategy: boolean;
} {
  if (input.outcome === "WIN" && input.pnlPercent > 0) {
    return {
      feedbackType: "POSITIVE",
      confidenceImpact: 4,
      strategyImpact: 3,
      shouldBoostStrategy: true,
      shouldReduceStrategy: false,
    };
  }

  if (input.outcome === "LOSS" && input.pnlPercent < 0) {
    return {
      feedbackType: "NEGATIVE",
      confidenceImpact: -5,
      strategyImpact: -4,
      shouldBoostStrategy: false,
      shouldReduceStrategy: true,
    };
  }

  return {
    feedbackType: "NEUTRAL",
    confidenceImpact: 1,
    strategyImpact: 0,
    shouldBoostStrategy: false,
    shouldReduceStrategy: false,
  };
}

export function buildTradeOutcomeFeedbackReport(): TradeOutcomeFeedbackReport {
  const paperExecution = buildPaperTradingExecutionReport();

  const feedback = paperExecution.executions.map((execution) => {
    const result = calculateFeedback({
      outcome: execution.simulatedOutcome,
      pnlPercent: execution.simulatedPnlPercent,
    });

    return {
      id: createFeedbackId(execution.symbol),
      sourceExecutionId: execution.id,
      symbol: execution.symbol,
      strategy: execution.strategy,
      direction: execution.direction,
      outcome: execution.simulatedOutcome,
      pnlAmount: execution.simulatedPnlAmount,
      pnlPercent: execution.simulatedPnlPercent,
      confidenceImpact: result.confidenceImpact,
      strategyImpact: result.strategyImpact,
      feedbackType: result.feedbackType,
      shouldBoostStrategy: result.shouldBoostStrategy,
      shouldReduceStrategy: result.shouldReduceStrategy,
      reason: `${execution.symbol} produced ${execution.simulatedOutcome} with ${execution.simulatedPnlPercent}% PnL. Feedback: ${result.feedbackType}.`,
      createdAt: new Date().toISOString(),
    };
  });

  const positiveFeedback = feedback.filter(
    (item) => item.feedbackType === "POSITIVE"
  ).length;

  const negativeFeedback = feedback.filter(
    (item) => item.feedbackType === "NEGATIVE"
  ).length;

  const neutralFeedback = feedback.filter(
    (item) => item.feedbackType === "NEUTRAL"
  ).length;

  const totalPnlAmount = Number(
    feedback.reduce((sum, item) => sum + item.pnlAmount, 0).toFixed(2)
  );

  const averagePnlPercent =
    feedback.length === 0
      ? 0
      : Number(
          (
            feedback.reduce((sum, item) => sum + item.pnlPercent, 0) /
            feedback.length
          ).toFixed(2)
        );

  const totalConfidenceImpact = feedback.reduce(
    (sum, item) => sum + item.confidenceImpact,
    0
  );

  const totalStrategyImpact = feedback.reduce(
    (sum, item) => sum + item.strategyImpact,
    0
  );

  const bestFeedbackItem =
    feedback.length === 0
      ? null
      : [...feedback].sort((a, b) => b.pnlAmount - a.pnlAmount)[0];

  const worstFeedbackItem =
    feedback.length === 0
      ? null
      : [...feedback].sort((a, b) => a.pnlAmount - b.pnlAmount)[0];

  const recommendation =
    feedback.length === 0
      ? "No trade outcome feedback available yet."
      : positiveFeedback > negativeFeedback
        ? "Trade outcome feedback is positive. Boost winning strategies and confidence carefully."
        : negativeFeedback > positiveFeedback
          ? "Trade outcome feedback is negative. Reduce weak strategies and lower confidence."
          : "Trade outcome feedback is neutral. Continue collecting execution results.";

  return {
    version: "V11.6.8",
    status: "READY",
    totalFeedbackItems: feedback.length,
    positiveFeedback,
    negativeFeedback,
    neutralFeedback,
    totalPnlAmount,
    averagePnlPercent,
    totalConfidenceImpact,
    totalStrategyImpact,
    bestFeedbackItem,
    worstFeedbackItem,
    feedback,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
