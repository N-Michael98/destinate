export type EvolutionFeedbackDecision =
  | "BOOST_EVOLUTION"
  | "MAINTAIN_EVOLUTION"
  | "REDUCE_EVOLUTION"
  | "PAUSE_EVOLUTION_REVIEW";

export type MutationPressure =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "EXTREME";

export type EvolutionFeedbackItem = {
  id: string;
  sourceLearningId: string;
  learningSignal: string;
  riskAction: string;
  performanceScore: number;
  evolutionImpactScore: number;
  confidenceDelta: number;
  strategyWeightDelta: number;
  allocationDelta: number;
  survivalScoreDelta: number;
  mutationPressure: MutationPressure;
  evolutionFeedbackScore: number;
  evolutionDecision: EvolutionFeedbackDecision;
  autonomousCycleBias:
    | "CONTINUE_EVOLUTION"
    | "REDUCE_RISK"
    | "PAUSE_EVOLUTION";
  reason: string;
};

export type OutcomeLearningEvolutionFeedbackSyncReport = {
  version: "V16.2.4";
  status: "READY";
  mode: "SIMULATION";
  totalFeedbackItems: number;
  boostItems: number;
  maintainItems: number;
  reduceItems: number;
  pauseItems: number;
  averageEvolutionFeedbackScore: number;
  strongestFeedbackItem: EvolutionFeedbackItem | null;
  feedbackItems: EvolutionFeedbackItem[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
