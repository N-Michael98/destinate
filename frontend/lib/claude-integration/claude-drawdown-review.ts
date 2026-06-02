import { ClaudeDrawdownReview } from "./claude-types";

export class ClaudeDrawdownReviewer {

  review(
    currentDrawdown: number,
    maxAllowedDrawdown: number
  ): ClaudeDrawdownReview {

    let decision: ClaudeDrawdownReview["decision"] =
      "APPROVE";

    let riskLevel = "LOW";

    const usage =
      (currentDrawdown / maxAllowedDrawdown) * 100;

    if (usage > 90) {
      decision = "BLOCK";
      riskLevel = "CRITICAL";
    }
    else if (usage > 70) {
      decision = "REVIEW";
      riskLevel = "HIGH";
    }

    return {
      currentDrawdown,
      maxAllowedDrawdown,
      riskLevel,
      decision
    };
  }
}