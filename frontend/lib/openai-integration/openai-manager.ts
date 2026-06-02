// lib/openai-integration/openai-manager.ts

import { openAIClient } from "./openai-client";
import { gptMarketAnalyst } from "./gpt-market-analyst";
import { gptStrategyReviewer } from "./gpt-strategy-review";
import { gptLearningReviewer } from "./gpt-learning-review";

export class OpenAIManager {
  getStatus() {
    return {
      enabled: openAIClient.isEnabled(),
      config: openAIClient.getConfig(),
    };
  }

  marketAnalyst() {
    return gptMarketAnalyst;
  }

  strategyReviewer() {
    return gptStrategyReviewer;
  }

  learningReviewer() {
    return gptLearningReviewer;
  }
}

export const openAIManager =
  new OpenAIManager();