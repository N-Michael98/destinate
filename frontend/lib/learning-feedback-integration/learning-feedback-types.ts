export type LearningFeedbackType =
  | "POSITIVE_LEARNING"
  | "NEGATIVE_LEARNING"
  | "NEUTRAL_LEARNING";

export type LearningFeedbackAction =
  | "BOOST_CONFIDENCE"
  | "REDUCE_CONFIDENCE"
  | "BOOST_STRATEGY_WEIGHT"
  | "REDUCE_STRATEGY_WEIGHT"
  | "STORE_OUTCOME_MEMORY"
  | "TRIGGER_SELF_EVOLUTION_REVIEW";

export type TradeOutcomeFeedbackItem = {
  id: string;
  sourceExecutionId: string;
  symbol: string;
  strategy: string;
  direction: string;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  pnlAmount: number;
  pnlPercent: number;
  confidenceImpact: number;
  strategyImpact: number;
  feedbackType: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  shouldBoostStrategy: boolean;
  shouldReduceStrategy: boolean;
  reason: string;
  createdAt: string;
};

export type LearningFeedbackSignal = {
  id: string;
  sourceFeedbackId: string;
  symbol: string;
  strategy: string;
  direction: string;
  outcome: string;
  pnlAmount: number;
  pnlPercent: number;
  learningType: LearningFeedbackType;
  confidenceAdjustment: number;
  strategyAdjustment: number;
  actions: LearningFeedbackAction[];
  shouldUpdateOutcomeLearning: boolean;
  shouldUpdateAdaptiveConfidence: boolean;
  shouldUpdateSelfEvolution: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  createdAt: string;
};

export type LearningFeedbackIntegrationReport = {
  version: "V11.7.0";
  status: "READY";
  mode: "SIMULATION";
  totalSignals: number;
  positiveSignals: number;
  negativeSignals: number;
  neutralSignals: number;
  totalConfidenceAdjustment: number;
  totalStrategyAdjustment: number;
  outcomeLearningUpdates: number;
  adaptiveConfidenceUpdates: number;
  selfEvolutionUpdates: number;
  signals: LearningFeedbackSignal[];
  recommendation: string;
  updatedAt: string;
};
