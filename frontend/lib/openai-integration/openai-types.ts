// lib/openai-integration/openai-types.ts

export type OpenAIDecision =
  | "LONG"
  | "SHORT"
  | "WAIT"
  | "BLOCK";

export interface GPTMarketAnalysis {
  market: string;
  strategy: string;

  decision: OpenAIDecision;

  confidence: number;

  reasoning: string[];

  opportunities: string[];

  risks: string[];

  timestamp: Date;
}

export interface GPTStrategyReview {
  strategy: string;

  score: number;

  strengths: string[];

  weaknesses: string[];

  marketFit: string;

  confidenceAdjustment: number;
}

export interface GPTLearningReview {
  period: "DAILY" | "WEEKLY" | "MONTHLY";

  bestStrategy: string;

  worstStrategy: string;

  keyLessons: string[];

  recommendations: string[];

  timestamp: Date;
}

export interface OpenAIConfig {
  enabled: boolean;

  model: string;

  temperature: number;

  maxTokens: number;
}

export interface OpenAIProviderStatus {
  connected: boolean;

  model: string;

  lastRequest?: Date;

  lastResponse?: Date;
}