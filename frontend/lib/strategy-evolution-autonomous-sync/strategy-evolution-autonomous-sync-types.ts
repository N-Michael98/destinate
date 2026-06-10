export type AutonomousFeedbackCycleDecision =
  | "CONTINUE_EVOLUTION"
  | "REDUCE_RISK"
  | "PAUSE_EVOLUTION";

export type StrategyEvolutionAutonomousSyncReport = {
  version: "V16.2.6";
  status: "READY";
  mode: "SIMULATION";

  baseAutonomousEvolutionScore: number;
  feedbackAdjustedAverageScore: number;
  feedbackBoost: number;
  adjustedAutonomousEvolutionScore: number;

  baseCycleDecision: AutonomousFeedbackCycleDecision;
  adjustedCycleDecision: AutonomousFeedbackCycleDecision;

  topAdjustedStrategy: string;
  weakestAdjustedStrategy: string;

  breakthroughStrategies: number;
  evolvingStrategies: number;
  stableStrategies: number;
  decliningStrategies: number;
  underReviewStrategies: number;

  mutationPressureMode: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  autonomousRiskBias: "EXPAND" | "NORMAL" | "DEFENSIVE" | "PAUSE";

  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
