import type { AiReview } from "./report-types";

export function getAgentReview(): AiReview {
  return {
    reviewer: "AGENT",
    score: 91,
    summary:
      "Agent plan discipline is strong. Demo plans match the current strategy ranking and confidence structure.",
  };
}