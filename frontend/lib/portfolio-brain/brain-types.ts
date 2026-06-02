export type BrainDecision =
  | "LONG"
  | "SHORT"
  | "WAIT"
  | "BLOCK";

export type BrainSource =
  | "GPT"
  | "CLAUDE"
  | "AGENT"
  | "CONSENSUS"
  | "PORTFOLIO"
  | "REGIME";

export interface BrainInput {
  source: BrainSource;
  signal: BrainDecision;
  confidence: number;
  reason: string;
}

export interface BrainResult {
  approved: boolean;
  finalDecision: BrainDecision;
  confidence: number;
  explanation: string;
}