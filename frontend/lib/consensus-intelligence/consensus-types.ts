export type AiSignalDirection = "LONG" | "SHORT" | "WAIT" | "BLOCK";

export type AiConsensusSignal = {
  source: "GPT" | "CLAUDE" | "AGENT";
  direction: AiSignalDirection;
  confidence: number;
  reason: string;
};

export type ConflictLevel = "NONE" | "MINOR" | "MEDIUM" | "HIGH";

export type ConsensusDecision = {
  decision: "APPROVED" | "REVIEW" | "BLOCKED";
  conflictLevel: ConflictLevel;
  agreementScore: number;
  reason: string;
};