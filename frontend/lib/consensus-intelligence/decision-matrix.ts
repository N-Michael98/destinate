import type {
  AiConsensusSignal,
  ConsensusDecision,
  ConflictLevel,
} from "./consensus-types";

export function calculateAgreementScore(
  signals: AiConsensusSignal[]
) {
  if (signals.length === 0) return 0;

  const averageConfidence =
    signals.reduce((sum, signal) => sum + signal.confidence, 0) /
    signals.length;

  return Math.round(averageConfidence);
}

export function buildConsensusDecision(
  signals: AiConsensusSignal[],
  conflictLevel: ConflictLevel
): ConsensusDecision {
  const agreementScore = calculateAgreementScore(signals);

  if (conflictLevel === "HIGH") {
    return {
      decision: "BLOCKED",
      conflictLevel,
      agreementScore,
      reason:
        "High conflict detected between AI signals. Trade is blocked for safety.",
    };
  }

  if (conflictLevel === "MEDIUM") {
    return {
      decision: "REVIEW",
      conflictLevel,
      agreementScore,
      reason:
        "Medium conflict detected. Manual or additional AI review is required.",
    };
  }

  if (agreementScore < 70) {
    return {
      decision: "REVIEW",
      conflictLevel,
      agreementScore,
      reason:
        "Agreement score is below the approval threshold.",
    };
  }

  return {
    decision: "APPROVED",
    conflictLevel,
    agreementScore,
    reason:
      "All AI signals are aligned and agreement score is acceptable.",
  };
}