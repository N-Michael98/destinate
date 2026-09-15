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

  /* `confidence: number` entfallen (15.09.) — der Manager gab hier
     bedingungslos 85 zurueck. Eine ungemessene Zahl gehoert nicht in die
     Antwort; Begruendung in `claude-risk-manager.ts`. */

  reasoning: string;

  createdAt: string;
}