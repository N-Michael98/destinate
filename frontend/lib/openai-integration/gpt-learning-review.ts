// lib/openai-integration/gpt-learning-review.ts

import {
  GPTLearningReview,
} from "./openai-types";

import { openAIClient } from "./openai-client";

export class GPTLearningReviewer {
  async reviewLearningCycle(
    period: "DAILY" | "WEEKLY" | "MONTHLY",
    summary: string
  ): Promise<GPTLearningReview> {
    const prompt = `
Review learning cycle.

Period:
${period}

Summary:
${summary}

Provide:

- Best strategy
- Worst strategy
- Key lessons
- Recommendations
`;

    const response =
      await openAIClient.generate(prompt);

    return {
      period,

      bestStrategy: "Momentum Breakout",

      worstStrategy: "Inventory Reaction",

      keyLessons: [
        response.slice(0, 150),
      ],

      recommendations: [
        "Increase quality filters",
        "Reduce weak setups",
      ],

      timestamp: new Date(),
    };
  }
}

export const gptLearningReviewer =
  new GPTLearningReviewer();