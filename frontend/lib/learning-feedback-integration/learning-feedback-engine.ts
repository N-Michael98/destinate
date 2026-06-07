import {
  LearningFeedbackAction,
  LearningFeedbackIntegrationReport,
  LearningFeedbackSignal,
  LearningFeedbackType,
  TradeOutcomeFeedbackItem,
} from "./learning-feedback-types";

function resolveLearningType(
  feedbackType: TradeOutcomeFeedbackItem["feedbackType"],
): LearningFeedbackType {
  if (feedbackType === "POSITIVE") return "POSITIVE_LEARNING";
  if (feedbackType === "NEGATIVE") return "NEGATIVE_LEARNING";
  return "NEUTRAL_LEARNING";
}

function resolvePriority(item: TradeOutcomeFeedbackItem): "LOW" | "MEDIUM" | "HIGH" {
  const absPnl = Math.abs(item.pnlPercent);
  const absConfidence = Math.abs(item.confidenceImpact);
  const absStrategy = Math.abs(item.strategyImpact);

  if (absPnl >= 2 || absConfidence >= 5 || absStrategy >= 4) return "HIGH";
  if (absPnl >= 1 || absConfidence >= 3 || absStrategy >= 2) return "MEDIUM";
  return "LOW";
}

function resolveActions(item: TradeOutcomeFeedbackItem): LearningFeedbackAction[] {
  const actions: LearningFeedbackAction[] = ["STORE_OUTCOME_MEMORY"];

  if (item.feedbackType === "POSITIVE") {
    actions.push("BOOST_CONFIDENCE");
  }

  if (item.feedbackType === "NEGATIVE") {
    actions.push("REDUCE_CONFIDENCE");
    actions.push("TRIGGER_SELF_EVOLUTION_REVIEW");
  }

  if (item.shouldBoostStrategy) {
    actions.push("BOOST_STRATEGY_WEIGHT");
  }

  if (item.shouldReduceStrategy) {
    actions.push("REDUCE_STRATEGY_WEIGHT");
    actions.push("TRIGGER_SELF_EVOLUTION_REVIEW");
  }

  if (Math.abs(item.pnlPercent) >= 2) {
    actions.push("TRIGGER_SELF_EVOLUTION_REVIEW");
  }

  return Array.from(new Set(actions));
}

function createLearningSignal(item: TradeOutcomeFeedbackItem): LearningFeedbackSignal {
  const actions = resolveActions(item);
  const learningType = resolveLearningType(item.feedbackType);

  return {
    id: `learning-feedback-${item.symbol.toLowerCase()}-${Date.now()}-${item.id}`,
    sourceFeedbackId: item.id,
    symbol: item.symbol,
    strategy: item.strategy,
    direction: item.direction,
    outcome: item.outcome,
    pnlAmount: item.pnlAmount,
    pnlPercent: item.pnlPercent,
    learningType,
    confidenceAdjustment: item.confidenceImpact,
    strategyAdjustment: item.strategyImpact,
    actions,
    shouldUpdateOutcomeLearning: actions.includes("STORE_OUTCOME_MEMORY"),
    shouldUpdateAdaptiveConfidence:
      actions.includes("BOOST_CONFIDENCE") || actions.includes("REDUCE_CONFIDENCE"),
    shouldUpdateSelfEvolution: actions.includes("TRIGGER_SELF_EVOLUTION_REVIEW"),
    priority: resolvePriority(item),
    reason: `${item.symbol} ${item.outcome} converted into ${learningType}. Confidence adjustment: ${item.confidenceImpact}, strategy adjustment: ${item.strategyImpact}.`,
    createdAt: new Date().toISOString(),
  };
}

export function buildLearningFeedbackIntegrationReport(
  feedbackItems: TradeOutcomeFeedbackItem[],
): LearningFeedbackIntegrationReport {
  const signals = feedbackItems.map(createLearningSignal);

  const positiveSignals = signals.filter(
    (signal) => signal.learningType === "POSITIVE_LEARNING",
  ).length;

  const negativeSignals = signals.filter(
    (signal) => signal.learningType === "NEGATIVE_LEARNING",
  ).length;

  const neutralSignals = signals.filter(
    (signal) => signal.learningType === "NEUTRAL_LEARNING",
  ).length;

  const totalConfidenceAdjustment = signals.reduce(
    (sum, signal) => sum + signal.confidenceAdjustment,
    0,
  );

  const totalStrategyAdjustment = signals.reduce(
    (sum, signal) => sum + signal.strategyAdjustment,
    0,
  );

  const outcomeLearningUpdates = signals.filter(
    (signal) => signal.shouldUpdateOutcomeLearning,
  ).length;

  const adaptiveConfidenceUpdates = signals.filter(
    (signal) => signal.shouldUpdateAdaptiveConfidence,
  ).length;

  const selfEvolutionUpdates = signals.filter(
    (signal) => signal.shouldUpdateSelfEvolution,
  ).length;

  const recommendation =
    negativeSignals > 0
      ? "Learning feedback contains negative signals. Outcome Learning, Adaptive Confidence and Self Evolution should review weak strategies."
      : positiveSignals > 0
        ? "Learning feedback is positive. Outcome Learning and Adaptive Confidence can carefully reinforce winning behavior."
        : "Learning feedback is neutral. Continue collecting more trade outcomes before changing strategy weights.";

  return {
    version: "V11.7.0",
    status: "READY",
    mode: "SIMULATION",
    totalSignals: signals.length,
    positiveSignals,
    negativeSignals,
    neutralSignals,
    totalConfidenceAdjustment,
    totalStrategyAdjustment,
    outcomeLearningUpdates,
    adaptiveConfidenceUpdates,
    selfEvolutionUpdates,
    signals,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
