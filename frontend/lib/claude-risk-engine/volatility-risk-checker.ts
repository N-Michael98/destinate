import { RiskLevel } from "./risk-types";

export function detectVolatilityRisk(
  volatility: string
): RiskLevel {

  switch (volatility) {

    case "VOLATILE":
      return "HIGH";

    case "NORMAL":
      return "MEDIUM";

    default:
      return "LOW";
  }
}