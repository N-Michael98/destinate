import type { AiReview } from "./report-types";

export function getClaudeReview(): AiReview {
  return {
    reviewer: "CLAUDE",
    score: 82,
    summary:
      "Risk is controlled. News and macro exposure should be monitored before increasing execution confidence.",
  };
}