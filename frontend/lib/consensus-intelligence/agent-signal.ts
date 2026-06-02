import type { AiConsensusSignal } from "./consensus-types";

export function getAgentSignal(): AiConsensusSignal {
  return {
    source: "AGENT",
    direction: "LONG",
    confidence: 83,
    reason:
      "Agent confirms that the setup matches current strategy ranking and execution rules.",
  };
}