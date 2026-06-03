import { RiskLevel } from "./risk-types";

export function detectDrawdownRisk(
  currentDrawdown: number
): RiskLevel {

  if (currentDrawdown >= 15) {
    return "EXTREME";
  }

  if (currentDrawdown >= 10) {
    return "HIGH";
  }

  if (currentDrawdown >= 5) {
    return "MEDIUM";
  }

  return "LOW";
}