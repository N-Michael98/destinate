import type { ConfidenceEntry } from "./confidence-types";

export function getConfidenceAdjustments(): ConfidenceEntry[] {
  return [
    {
      strategy: "Momentum Breakout",
      oldConfidence: 83,
      newConfidence: 86,
      reason: "Strong recent performance",
    },

    {
      strategy: "Risk-Off Trend",
      oldConfidence: 78,
      newConfidence: 79,
      reason: "Stable profitability",
    },

    {
      strategy: "Inventory Reaction",
      oldConfidence: 71,
      newConfidence: 67,
      reason: "Recent losses",
    },
  ];
}