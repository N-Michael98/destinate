import type { ConfidenceUpdate } from "./feedback-types";

export function generateConfidenceUpdates(): ConfidenceUpdate[] {
  return [
    {
      strategy: "Momentum Breakout",
      oldConfidence: 83,
      newConfidence: 86,
    },

    {
      strategy: "Risk-Off Trend",
      oldConfidence: 78,
      newConfidence: 79,
    },

    {
      strategy: "Inventory Reaction",
      oldConfidence: 71,
      newConfidence: 67,
    },
  ];
}