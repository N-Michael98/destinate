import type { BrainResult, BrainSafetyResult } from "./brain-types";

export function validateBrainSafety(
  result: BrainResult
): BrainSafetyResult {
  if (!result.approved) {
    return {
      safe: false,
      safetyScore: 0,
      blockReason: result.explanation,
      maxRiskAllowed: 0,
      liveTradingEnabled: false,
    };
  }

  if (result.confidence < 70) {
    return {
      safe: false,
      safetyScore: 45,
      blockReason:
        "Brain confidence is below the minimum safety threshold.",
      maxRiskAllowed: 0,
      liveTradingEnabled: false,
    };
  }

  if (result.averageRiskScore >= 65) {
    return {
      safe: false,
      safetyScore: 40,
      blockReason:
        "Average risk score is too high for safe execution.",
      maxRiskAllowed: 0,
      liveTradingEnabled: false,
    };
  }

  const safetyScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        result.confidence * 0.45 +
          (100 - result.averageRiskScore) * 0.35 +
          result.agreementScore * 0.2
      )
    )
  );

  return {
    safe: safetyScore >= 70,
    safetyScore,
    blockReason:
      safetyScore >= 70
        ? null
        : "Safety score is below execution threshold.",
    maxRiskAllowed: safetyScore >= 85 ? 1 : 0.5,
    liveTradingEnabled: false,
  };
}