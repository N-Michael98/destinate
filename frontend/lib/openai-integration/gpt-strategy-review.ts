// lib/openai-integration/gpt-strategy-review.ts

import {
  GPTStrategyReview,
} from "./openai-types";

import { openAIClient } from "./openai-client";

export class GPTStrategyReviewer {
  async reviewStrategy(
    strategy: string,
    performanceSummary: string
  ): Promise<GPTStrategyReview> {
    const prompt = `
Review this trading strategy.

Strategy:
${strategy}

Performance:
${performanceSummary}

Evaluate:

- Strengths
- Weaknesses
- Market Fit
- Suggested Confidence Adjustment
`;

    const response =
      await openAIClient.generate(prompt);

    return {
      strategy,

      score: 80,

      strengths: [
        "Review parsing later",
      ],

      weaknesses: [
        "Review parsing later",
      ],

      marketFit: response.slice(0, 150),

      confidenceAdjustment: 2,
    };
  }
}

export const gptStrategyReviewer =
  new GPTStrategyReviewer();