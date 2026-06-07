import type {
  LearningSignal,
  OutcomeLearningAutoUpdateReport,
  OutcomeLearningMemoryUpdate,
  StrategyLearningScore,
} from "./outcome-learning-types";

const mockLearningSignals: LearningSignal[] = [
  {
    id: "learning-feedback-spx500-v1172",
    sourceFeedbackId: "trade-feedback-spx500-v1170",
    symbol: "SPX500",
    strategy: "Trend Continuation Strategy",
    direction: "LONG",
    outcome: "WIN",
    pnlAmount: 150,
    pnlPercent: 1.5,
    learningType: "POSITIVE_LEARNING",
    confidenceAdjustment: 4,
    strategyAdjustment: 3,
    actions: ["STORE_OUTCOME_MEMORY", "BOOST_CONFIDENCE", "BOOST_STRATEGY_WEIGHT"],
    shouldUpdateOutcomeLearning: true,
    shouldUpdateAdaptiveConfidence: true,
    shouldUpdateSelfEvolution: false,
    priority: "MEDIUM",
    reason: "SPX500 WIN converted into POSITIVE_LEARNING.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "learning-feedback-nas100-v1172",
    sourceFeedbackId: "trade-feedback-nas100-v1170",
    symbol: "NAS100",
    strategy: "Trend Continuation Strategy",
    direction: "LONG",
    outcome: "WIN",
    pnlAmount: 150,
    pnlPercent: 1.5,
    learningType: "POSITIVE_LEARNING",
    confidenceAdjustment: 4,
    strategyAdjustment: 3,
    actions: ["STORE_OUTCOME_MEMORY", "BOOST_CONFIDENCE", "BOOST_STRATEGY_WEIGHT"],
    shouldUpdateOutcomeLearning: true,
    shouldUpdateAdaptiveConfidence: true,
    shouldUpdateSelfEvolution: false,
    priority: "MEDIUM",
    reason: "NAS100 WIN converted into POSITIVE_LEARNING.",
    createdAt: new Date().toISOString(),
  },
];

function groupSignalsByStrategyAndSymbol(signals: LearningSignal[]) {
  return signals.reduce<Record<string, LearningSignal[]>>((groups, signal) => {
    const key = `${signal.strategy}::${signal.symbol}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(signal);
    return groups;
  }, {});
}

function calculateStatus(learningScore: number): "IMPROVING" | "WEAKENING" | "STABLE" {
  if (learningScore >= 65) return "IMPROVING";
  if (learningScore <= 35) return "WEAKENING";
  return "STABLE";
}

function calculateStrategyLearningScore(signals: LearningSignal[]): StrategyLearningScore {
  const firstSignal = signals[0];

  const wins = signals.filter((signal) => signal.outcome === "WIN").length;
  const losses = signals.filter((signal) => signal.outcome === "LOSS").length;
  const neutral = signals.length - wins - losses;

  const totalPnlAmount = signals.reduce((sum, signal) => sum + signal.pnlAmount, 0);
  const totalPnlPercent = signals.reduce((sum, signal) => sum + signal.pnlPercent, 0);
  const totalConfidenceAdjustment = signals.reduce(
    (sum, signal) => sum + signal.confidenceAdjustment,
    0,
  );
  const totalStrategyAdjustment = signals.reduce(
    (sum, signal) => sum + signal.strategyAdjustment,
    0,
  );

  const winRate = signals.length > 0 ? Math.round((wins / signals.length) * 100) : 0;
  const averagePnlPercent =
    signals.length > 0 ? Number((totalPnlPercent / signals.length).toFixed(2)) : 0;

  const confidenceScore = Math.max(0, Math.min(100, 50 + totalConfidenceAdjustment * 5));
  const strategyScore = Math.max(0, Math.min(100, 50 + totalStrategyAdjustment * 5));

  const learningScore = Math.round(
    winRate * 0.4 +
      confidenceScore * 0.25 +
      strategyScore * 0.25 +
      Math.max(0, Math.min(100, 50 + averagePnlPercent * 10)) * 0.1,
  );

  const status = calculateStatus(learningScore);

  const recommendation =
    status === "IMPROVING"
      ? "Strategy is improving. Keep collecting confirmations and prepare for controlled weight increase."
      : status === "WEAKENING"
        ? "Strategy is weakening. Reduce exposure and send to Self Evolution review."
        : "Strategy is stable. Continue collecting more learning signals before changing weights.";

  return {
    strategy: firstSignal.strategy,
    symbol: firstSignal.symbol,
    totalSignals: signals.length,
    wins,
    losses,
    neutral,
    winRate,
    totalPnlAmount,
    averagePnlPercent,
    confidenceScore,
    strategyScore,
    learningScore,
    status,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}

function createMemoryUpdate(score: StrategyLearningScore): OutcomeLearningMemoryUpdate {
  const scoreBefore = 50;
  const scoreAfter = score.learningScore;

  const updateType =
    score.status === "IMPROVING"
      ? "BOOST"
      : score.status === "WEAKENING"
        ? "REDUCE"
        : "HOLD";

  return {
    id: `outcome-learning-memory-${score.symbol.toLowerCase()}-${Date.now()}`,
    strategy: score.strategy,
    symbol: score.symbol,
    updateType,
    scoreBefore,
    scoreAfter,
    reason: `${score.strategy} on ${score.symbol} updated from ${scoreBefore} to ${scoreAfter}. Status: ${score.status}.`,
    createdAt: new Date().toISOString(),
  };
}

export function getOutcomeLearningAutoUpdateReport(): OutcomeLearningAutoUpdateReport {
  const updateableSignals = mockLearningSignals.filter(
    (signal) => signal.shouldUpdateOutcomeLearning,
  );

  const groupedSignals = groupSignalsByStrategyAndSymbol(updateableSignals);

  const strategyLearningScores = Object.values(groupedSignals).map(
    calculateStrategyLearningScore,
  );

  const memoryUpdates = strategyLearningScores.map(createMemoryUpdate);

  const improvingStrategies = strategyLearningScores.filter(
    (score) => score.status === "IMPROVING",
  ).length;

  const weakeningStrategies = strategyLearningScores.filter(
    (score) => score.status === "WEAKENING",
  ).length;

  const stableStrategies = strategyLearningScores.filter(
    (score) => score.status === "STABLE",
  ).length;

  const recommendation =
    weakeningStrategies > 0
      ? "Some strategies are weakening. Send them to Self Evolution and reduce future strategy weight."
      : improvingStrategies > 0
        ? "Outcome Learning confirms improving strategies. Prepare data for Strategy Weight Auto-Rebalancing."
        : "Outcome Learning is stable. Keep collecting more feedback before rebalancing.";

  return {
    version: "V11.7.2",
    status: "READY",
    mode: "SIMULATION",
    totalLearningSignals: updateableSignals.length,
    totalStrategiesUpdated: strategyLearningScores.length,
    improvingStrategies,
    weakeningStrategies,
    stableStrategies,
    totalMemoryUpdates: memoryUpdates.length,
    strategyLearningScores,
    memoryUpdates,
    institutionalSourceNote:
      "Prepared for future Bank & Institutional Intelligence integration: central banks, major banks, market outlooks, policy statements and macro research can be used as additional learning context.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
