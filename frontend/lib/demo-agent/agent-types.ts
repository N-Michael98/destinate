export type AgentDecision = {
  market: string;
  strategy: string;
  direction: "LONG" | "SHORT";
  confidence: number;
};

export type AgentStatus =
  | "IDLE"
  | "ANALYZING"
  | "READY";

export type AgentPlan = {
  id: string;
  market: string;
  setup: string;
  confidence: number;
};