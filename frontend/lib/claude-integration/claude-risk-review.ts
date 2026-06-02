import { ClaudeRiskReview } from "./claude-types";

export class ClaudeRiskReviewer {
  review(
    market: string,
    volatilityRisk: number,
    newsRisk: number,
    drawdownRisk: number
  ): ClaudeRiskReview {

    const riskScore =
      (volatilityRisk + newsRisk + drawdownRisk) / 3;

    let decision: ClaudeRiskReview["decision"] =
      "APPROVE";

    if (riskScore > 70)
      decision = "BLOCK";
    else if (riskScore > 50)
      decision = "REVIEW";

    return {
      market,
      riskScore,
      newsRisk,
      volatilityRisk,
      drawdownRisk,
      decision
    };
  }
}