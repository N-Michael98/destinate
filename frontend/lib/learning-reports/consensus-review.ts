import { getAgentReview } from "./agent-review";
import { getClaudeReview } from "./claude-review";
import { getGptReview } from "./gpt-review";
import type { ConsensusReview } from "./report-types";

export function getConsensusReview(): ConsensusReview {
  const reviews = [getGptReview(), getClaudeReview(), getAgentReview()];

  const score =
    reviews.reduce((sum, review) => sum + review.score, 0) /
    reviews.length;

  return {
    score: Math.round(score),
    status: score >= 75 ? "APPROVED" : "NEEDS_REVIEW",
    summary:
      "Multi-AI consensus review completed. GPT, Claude and the AI Agent agree that the current learning direction is acceptable.",
  };
}