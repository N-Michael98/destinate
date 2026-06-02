import type { BrainInput } from "./brain-types";

export function getBrainInputs(): BrainInput[] {
  return [
    {
      source: "GPT",
      signal: "LONG",
      confidence: 84,
      reason: "Momentum breakout detected",
    },
    {
      source: "CLAUDE",
      signal: "LONG",
      confidence: 80,
      reason: "Risk acceptable",
    },
    {
      source: "AGENT",
      signal: "LONG",
      confidence: 83,
      reason: "Execution plan valid",
    },
    {
      source: "REGIME",
      signal: "LONG",
      confidence: 88,
      reason: "Trending market",
    },
    {
      source: "PORTFOLIO",
      signal: "LONG",
      confidence: 79,
      reason: "Exposure acceptable",
    },
  ];
}