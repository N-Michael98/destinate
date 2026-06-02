import type { RegimeAnalysis } from "./regime-types";

export function analyzeRiskRegime(
  market: string
): RegimeAnalysis {
  return {
    market,
    regime: "RISK_OFF",
    confidence: 82,
    reason:
      "Macro environment favors defensive positioning and safe-haven assets.",
  };
}