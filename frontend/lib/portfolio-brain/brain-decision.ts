import type {
  BrainDecision,
  BrainInput,
  BrainResult,
} from "./brain-types";

export function calculateBrainDecision(
  inputs: BrainInput[]
): BrainResult {
  const longVotes = inputs.filter(
    (x) => x.signal === "LONG"
  ).length;

  const shortVotes = inputs.filter(
    (x) => x.signal === "SHORT"
  ).length;

  const waitVotes = inputs.filter(
    (x) => x.signal === "WAIT"
  ).length;

  if (waitVotes > 0) {
    return {
      approved: false,
      finalDecision: "WAIT",
      confidence: 0,
      explanation: "Waiting for confirmation",
    };
  }

  if (longVotes > shortVotes) {
    return {
      approved: true,
      finalDecision: "LONG",
      confidence: 83,
      explanation: "Consensus long approval",
    };
  }

  if (shortVotes > longVotes) {
    return {
      approved: true,
      finalDecision: "SHORT",
      confidence: 81,
      explanation: "Consensus short approval",
    };
  }

  return {
    approved: false,
    finalDecision: "BLOCK",
    confidence: 0,
    explanation: "Conflict detected",
  };
}