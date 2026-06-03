import { RiskLevel } from "./risk-types";

export function detectExposureRisk(
  exposurePercent: number
): RiskLevel {

  if (exposurePercent >= 80) {
    return "EXTREME";
  }

  if (exposurePercent >= 60) {
    return "HIGH";
  }

  if (exposurePercent >= 40) {
    return "MEDIUM";
  }

  return "LOW";
}