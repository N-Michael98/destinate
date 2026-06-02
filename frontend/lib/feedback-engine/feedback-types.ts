export type FeedbackItem = {
  market: string;
  strategy: string;
  result: "WIN" | "LOSS";
  action: string;
};

export type ConfidenceUpdate = {
  strategy: string;
  oldConfidence: number;
  newConfidence: number;
};