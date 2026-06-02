import type { AiConsensusSignal } from "./consensus-types";

export function getGptSignal(): AiConsensusSignal {
  return {
    source: "GPT",
    direction: "LONG",
    confidence: 84,
    reason:
      "GPT detects a strong technical opportunity with momentum confirmation.",
  };
}