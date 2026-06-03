export type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "EXTREME";

export interface RiskAssessment {
  symbol: string;

  drawdownRisk: RiskLevel;
  exposureRisk: RiskLevel;
  positionRisk: RiskLevel;
  volatilityRisk: RiskLevel;

  overallRisk: RiskLevel;

  approved: boolean;

  confidence: number;

  reasoning: string;

  createdAt: string;
}