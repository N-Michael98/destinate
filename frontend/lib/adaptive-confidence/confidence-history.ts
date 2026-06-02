import type { ConfidenceHistory } from "./confidence-types";

export function getConfidenceHistory(): ConfidenceHistory[] {
  return [
    {
      strategy: "Momentum Breakout",
      confidence: 86,
      timestamp: "Latest",
    },

    {
      strategy: "Risk-Off Trend",
      confidence: 79,
      timestamp: "Latest",
    },

    {
      strategy: "Inventory Reaction",
      confidence: 67,
      timestamp: "Latest",
    },
  ];
}