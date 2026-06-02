export type ConfidenceEntry = {
  strategy: string;
  oldConfidence: number;
  newConfidence: number;
  reason: string;
};

export type ConfidenceHistory = {
  strategy: string;
  confidence: number;
  timestamp: string;
};