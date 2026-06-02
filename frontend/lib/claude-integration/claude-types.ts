export type ClaudeDecision =
  | "APPROVE"
  | "REVIEW"
  | "BLOCK";

export interface ClaudeRiskReview {
  market: string;
  riskScore: number;
  newsRisk: number;
  volatilityRisk: number;
  drawdownRisk: number;
  decision: ClaudeDecision;
}

export interface ClaudePortfolioReview {
  exposureScore: number;
  correlationScore: number;
  diversificationScore: number;
  decision: ClaudeDecision;
}

export interface ClaudeDrawdownReview {
  currentDrawdown: number;
  maxAllowedDrawdown: number;
  riskLevel: string;
  decision: ClaudeDecision;
}