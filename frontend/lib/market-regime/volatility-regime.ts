import type { RegimeAnalysis } from "./regime-types";

export function analyzeVolatilityRegime(
  market: string
): RegimeAnalysis {
  return {
    market,
    regime: "VOLATILE",
    confidence: 78,
    reason:
      "Recent price movement indicates elevated volatility conditions.",
  };
}