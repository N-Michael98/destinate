import type { AiReview } from "./report-types";

export function getGptReview(): AiReview {
  return {
    reviewer: "GPT",
    score: 89,
    summary:
      "Trade quality and technical structure are strong. Momentum Breakout shows the best setup quality.",
  };
}