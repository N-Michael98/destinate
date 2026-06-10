export type OutcomeLearningSignal =
  | "PROMOTE_STRATEGY"
  | "KEEP_STRATEGY"
  | "REDUCE_STRATEGY"
  | "PAUSE_STRATEGY";

export type OutcomeLearningRiskAction =
  | "ALLOW_NORMAL_RISK"
  | "ALLOW_REDUCED_RISK"
  | "REQUIRE_REVIEW"
  | "BLOCK_NEW_TRADES";

export type PerformanceOutcomeLearningItem = {
  id: string;
  source: "PAPER_ACCOUNT_PERFORMANCE";
  performanceScore: number;
  riskGrade: string;
  totalTrades: number;
  winRate: number;
  lossRate: number;
  profitFactor: number;
  netPnL: number;
  returnPercent: number;
  averagePnL: number;
  bestPnL: number;
  worstPnL: number;
  learningSignal: OutcomeLearningSignal;
  riskAction: OutcomeLearningRiskAction;
  confidenceAdjustment: number;
  strategyWeightAdjustment: number;
  evolutionImpactScore: number;
  reason: string;
};

export type PerformanceOutcomeLearningSyncReport = {
  version: "V16.2.3";
  status: "READY";
  mode: "SIMULATION";
  totalLearningItems: number;
  promoteSignals: number;
  keepSignals: number;
  reduceSignals: number;
  pauseSignals: number;
  averageEvolutionImpactScore: number;
  bestLearningItem: PerformanceOutcomeLearningItem | null;
  learningItems: PerformanceOutcomeLearningItem[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
