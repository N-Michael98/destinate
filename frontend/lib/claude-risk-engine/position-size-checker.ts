import { RiskLevel } from "./risk-types";

export function detectPositionRisk(
  riskPercent: number
): RiskLevel {

  if (riskPercent >= 5) {
    return "EXTREME";
  }

  if (riskPercent >= 3) {
    return "HIGH";
  }

  if (riskPercent >= 2) {
    return "MEDIUM";
  }

  return "LOW";
}