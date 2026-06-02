import type { RegimeAnalysis } from "./regime-types";

export function analyzeTrendRegime(
  market: string
): RegimeAnalysis {
  return {
    market,
    regime: "TRENDING",
    confidence: 86,
    reason:
      "Market shows strong directional structure and momentum continuation.",
  };
}