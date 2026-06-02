// lib/openai-integration/gpt-market-analyst.ts

import {
  GPTMarketAnalysis,
} from "./openai-types";

import { openAIClient } from "./openai-client";

export class GPTMarketAnalyst {
  async analyzeMarket(
    market: string,
    strategy: string,
    context: string
  ): Promise<GPTMarketAnalysis> {
    const prompt = `
You are a professional trading analyst.

Market:
${market}

Strategy:
${strategy}

Context:
${context}

Return:
- Decision (LONG / SHORT / WAIT / BLOCK)
- Confidence 0-100
- Opportunities
- Risks
- Reasoning
`;

    const response = await openAIClient.generate(prompt);

    return {
      market,
      strategy,

      decision: "WAIT",

      confidence: 70,

      reasoning: [
        "Mock parser active",
        response.slice(0, 300),
      ],

      opportunities: [
        "Opportunity detection later",
      ],

      risks: [
        "Risk extraction later",
      ],

      timestamp: new Date(),
    };
  }
}

export const gptMarketAnalyst =
  new GPTMarketAnalyst();