import type { AiConsensusSignal } from "./consensus-types";

export function getClaudeRiskSignal(): AiConsensusSignal {
  return {
    source: "CLAUDE",
    direction: "LONG",
    confidence: 79,
    reason:
      "Claude risk review accepts the trade because drawdown and macro risk are controlled.",
  };
}