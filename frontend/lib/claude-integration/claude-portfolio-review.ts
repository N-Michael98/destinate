import { ClaudePortfolioReview } from "./claude-types";

export class ClaudePortfolioReviewer {

  review(
    exposureScore: number,
    correlationScore: number,
    diversificationScore: number
  ): ClaudePortfolioReview {

    const average =
      (exposureScore +
        correlationScore +
        diversificationScore) / 3;

    let decision: ClaudePortfolioReview["decision"] =
      "APPROVE";

    if (average < 40)
      decision = "BLOCK";
    else if (average < 60)
      decision = "REVIEW";

    return {
      exposureScore,
      correlationScore,
      diversificationScore,
      decision
    };
  }
}