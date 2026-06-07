export type LearningSignal = {
  id: string;
  sourceFeedbackId: string;
  symbol: string;
  strategy: string;
  direction: string;
  outcome: string;
  pnlAmount: number;
  pnlPercent: number;
  learningType: string;
  confidenceAdjustment: number;
  strategyAdjustment: number;
  actions: string[];
  shouldUpdateOutcomeLearning: boolean;
  shouldUpdateAdaptiveConfidence: boolean;
  shouldUpdateSelfEvolution: boolean;
  priority: string;
  reason: string;
  createdAt: string;
};

export type StrategyLearningScore = {
  strategy: string;
  symbol: string;
  totalSignals: number;
  wins: number;
  losses: number;
  neutral: number;
  winRate: number;
  totalPnlAmount: number;
  averagePnlPercent: number;
  confidenceScore: number;
  strategyScore: number;
  learningScore: number;
  status: "IMPROVING" | "WEAKENING" | "STABLE";
  recommendation: string;
  updatedAt: string;
};

export type OutcomeLearningMemoryUpdate = {
  id: string;
  strategy: string;
  symbol: string;
  updateType: "BOOST" | "REDUCE" | "HOLD";
  scoreBefore: number;
  scoreAfter: number;
  reason: string;
  createdAt: string;
};

export type OutcomeLearningAutoUpdateReport = {
  version: "V11.7.2";
  status: "READY";
  mode: "SIMULATION";
  totalLearningSignals: number;
  totalStrategiesUpdated: number;
  improvingStrategies: number;
  weakeningStrategies: number;
  stableStrategies: number;
  totalMemoryUpdates: number;
  strategyLearningScores: StrategyLearningScore[];
  memoryUpdates: OutcomeLearningMemoryUpdate[];
  institutionalSourceNote: string;
  recommendation: string;
  updatedAt: string;
};
