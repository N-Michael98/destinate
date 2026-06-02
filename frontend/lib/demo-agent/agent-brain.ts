import type { AgentDecision } from "./agent-types";

export function generateMockDecision(): AgentDecision {
  return {
    market: "NAS100",
    strategy: "Momentum Breakout",
    direction: "LONG",
    confidence: 83,
  };
}