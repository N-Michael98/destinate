import {
  buildLearningFeedbackIntegrationReport,
} from "./learning-feedback-engine";

import type {
  LearningFeedbackIntegrationReport,
  TradeOutcomeFeedbackItem,
} from "./learning-feedback-types";

const mockTradeOutcomeFeedback: TradeOutcomeFeedbackItem[] = [
  {
    id: "trade-feedback-spx500-v1170",
    sourceExecutionId: "paper-execution-spx500-v1170",
    symbol: "SPX500",
    strategy: "Trend Continuation Strategy",
    direction: "LONG",
    outcome: "WIN",
    pnlAmount: 150,
    pnlPercent: 1.5,
    confidenceImpact: 4,
    strategyImpact: 3,
    feedbackType: "POSITIVE",
    shouldBoostStrategy: true,
    shouldReduceStrategy: false,
    reason: "SPX500 produced WIN with 1.5% PnL. Feedback: POSITIVE.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "trade-feedback-nas100-v1170",
    sourceExecutionId: "paper-execution-nas100-v1170",
    symbol: "NAS100",
    strategy: "Trend Continuation Strategy",
    direction: "LONG",
    outcome: "WIN",
    pnlAmount: 150,
    pnlPercent: 1.5,
    confidenceImpact: 4,
    strategyImpact: 3,
    feedbackType: "POSITIVE",
    shouldBoostStrategy: true,
    shouldReduceStrategy: false,
    reason: "NAS100 produced WIN with 1.5% PnL. Feedback: POSITIVE.",
    createdAt: new Date().toISOString(),
  },
];

export function getLearningFeedbackIntegrationReport(): LearningFeedbackIntegrationReport {
  return buildLearningFeedbackIntegrationReport(mockTradeOutcomeFeedback);
}
