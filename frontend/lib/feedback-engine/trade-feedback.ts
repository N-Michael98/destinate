import type { FeedbackItem } from "./feedback-types";

export function generateTradeFeedback(): FeedbackItem[] {
  return [
    {
      market: "NAS100",
      strategy: "Momentum Breakout",
      result: "WIN",
      action: "Increase confidence",
    },

    {
      market: "XAUUSD",
      strategy: "Risk-Off Trend",
      result: "WIN",
      action: "Keep active",
    },

    {
      market: "USOIL",
      strategy: "Inventory Reaction",
      result: "LOSS",
      action: "Review conditions",
    },
  ];
}