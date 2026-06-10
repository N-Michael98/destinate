export type FeedbackAdjustedEvolutionStatus =
  | "BREAKTHROUGH"
  | "EVOLVING"
  | "STABLE"
  | "DECLINING"
  | "UNDER_REVIEW";

export type EvolutionFeedbackStrategyEvolutionEntry = {
  strategyId: string;
  strategyName: string;
  market: string;
  symbol: string;
  baseEvolutionScore: number;
  feedbackScore: number;
  feedbackDecision: string;
  mutationPressure: string;
  confidenceDelta: number;
  strategyWeightDelta: number;
  allocationDelta: number;
  survivalScoreDelta: number;
  adjustedEvolutionScore: number;
  adjustedGrowthRate: number;
  adjustedDecayRisk: number;
  adjustedProjectedFutureScore: number;
  adjustedStatus: FeedbackAdjustedEvolutionStatus;
  reason: string;
};

export type EvolutionFeedbackStrategyEvolutionSyncReport = {
  version: "V16.2.5";
  status: "READY";
  mode: "SIMULATION";
  totalStrategies: number;
  breakthroughStrategies: number;
  evolvingStrategies: number;
  stableStrategies: number;
  decliningStrategies: number;
  underReviewStrategies: number;
  strongestAdjustedEvolution: string;
  weakestAdjustedEvolution: string;
  entries: EvolutionFeedbackStrategyEvolutionEntry[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
