import { getAgentSignal } from "./agent-signal";
import { getClaudeRiskSignal } from "./claude-risk-signal";
import { detectConflict } from "./conflict-detector";
import { buildConsensusDecision } from "./decision-matrix";
import { getGptSignal } from "./gpt-signal";

export function getConsensusCoreStatus() {
  return {
    status: "READY",
    conflictDetection: true,
    singleModelDecisionAllowed: false,
  };
}

export function getConsensusSignals() {
  return [
    getGptSignal(),
    getClaudeRiskSignal(),
    getAgentSignal(),
  ];
}

export function getFinalConsensusDecision() {
  const signals = getConsensusSignals();
  const conflictLevel = detectConflict(signals);

  return buildConsensusDecision(signals, conflictLevel);
}

export function getConsensusRoadmap() {
  return {
    currentPhase: "Consensus Intelligence Core",

    nextSteps: [
      "Market Regime Engine",
      "Portfolio Intelligence",
      "AI Trading Brain",
      "OpenAI Provider Integration",
      "Claude Provider Integration",
    ],
  };
}