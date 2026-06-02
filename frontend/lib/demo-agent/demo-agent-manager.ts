import { generateMockDecision } from "./agent-brain";
import { generateConsensus } from "./agent-consensus";
import { generateTradePlans } from "./trade-planner";

export function getAgentStatus() {
  return {
    status: "READY",

    mode: "Planning Only",

    liveExecution: false,
  };
}

export function getAgentDecision() {
  return generateMockDecision();
}

export function getAgentConsensus() {
  return generateConsensus();
}

export function getAgentPlans() {
  return generateTradePlans();
}

export function getAgentRoadmap() {
  return {
    currentPhase: "Demo Trading Agent",

    nextPhases: [
      "Demo Execution",
      "Performance Tracking",
      "Adaptive Learning",
      "Controlled Live Trading",
    ],
  };
}