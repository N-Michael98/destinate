import type { RegimeAnalysis } from "./regime-types";

export function analyzeNewsRegime(
  market: string
): RegimeAnalysis {
  return {
    market,
    regime: "NEWS_DRIVEN",
    confidence: 74,
    reason:
      "Upcoming macroeconomic events may influence market direction.",
  };
}