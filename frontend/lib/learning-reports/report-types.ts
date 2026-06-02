export type AiReview = {
  reviewer: "GPT" | "CLAUDE" | "AGENT";
  score: number;
  summary: string;
};

export type ConsensusReview = {
  score: number;
  status: "APPROVED" | "NEEDS_REVIEW";
  summary: string;
};

export type LearningReport = {
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  trades: number;
  winrate: number;
  bestStrategy: string;
  weakestStrategy: string;
  consensusScore: number;
};