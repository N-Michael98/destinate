import type {
  BrainDecision,
  BrainInput,
  BrainResult,
  BrainRiskLevel,
} from "./brain-types";

function getRiskLevel(score: number): BrainRiskLevel {
  if (score >= 85) return "EXTREME";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function countVotes(inputs: BrainInput[], decision: BrainDecision) {
  return inputs.filter((item) => item.signal === decision).length;
}

export function calculateBrainDecision(
  inputs: BrainInput[]
): BrainResult {
  const longVotes = countVotes(inputs, "LONG");
  const shortVotes = countVotes(inputs, "SHORT");
  const waitVotes = countVotes(inputs, "WAIT");
  const blockVotes = countVotes(inputs, "BLOCK");

  const averageConfidence =
    inputs.length > 0
      ? Number(
          (
            inputs.reduce((sum, item) => sum + item.confidence, 0) /
            inputs.length
          ).toFixed(2)
        )
      : 0;

  const averageRiskScore =
    inputs.length > 0
      ? Number(
          (
            inputs.reduce((sum, item) => sum + item.riskScore, 0) /
            inputs.length
          ).toFixed(2)
        )
      : 0;

  const strongestVote = Math.max(
    longVotes,
    shortVotes,
    waitVotes,
    blockVotes
  );

  const agreementScore =
    inputs.length > 0
      ? Number(((strongestVote / inputs.length) * 100).toFixed(2))
      : 0;

  const riskLevel = getRiskLevel(averageRiskScore);

  if (blockVotes > 0 || averageRiskScore >= 85) {
    return {
      version: "V11.3.0",
      approved: false,
      finalDecision: "BLOCK",
      confidence: 0,
      averageConfidence,
      averageRiskScore,
      agreementScore,
      riskLevel,
      explanation:
        "Portfolio Brain blocked the decision because at least one critical source requested BLOCK or average risk is extreme.",
      inputs,
      updatedAt: new Date().toISOString(),
    };
  }

  if (waitVotes > 0 || averageRiskScore >= 65) {
    return {
      version: "V11.3.0",
      approved: false,
      finalDecision: "WAIT",
      confidence: Math.max(0, averageConfidence - 20),
      averageConfidence,
      averageRiskScore,
      agreementScore,
      riskLevel,
      explanation:
        "Portfolio Brain recommends WAIT because risk is elevated or one source requested more confirmation.",
      inputs,
      updatedAt: new Date().toISOString(),
    };
  }

  if (longVotes > shortVotes && agreementScore >= 60) {
    return {
      version: "V11.3.0",
      approved: true,
      finalDecision: "LONG",
      confidence: averageConfidence,
      averageConfidence,
      averageRiskScore,
      agreementScore,
      riskLevel,
      explanation:
        "Portfolio Brain approved LONG because bullish inputs have majority agreement and risk is acceptable.",
      inputs,
      updatedAt: new Date().toISOString(),
    };
  }

  if (shortVotes > longVotes && agreementScore >= 60) {
    return {
      version: "V11.3.0",
      approved: true,
      finalDecision: "SHORT",
      confidence: averageConfidence,
      averageConfidence,
      averageRiskScore,
      agreementScore,
      riskLevel,
      explanation:
        "Portfolio Brain approved SHORT because bearish inputs have majority agreement and risk is acceptable.",
      inputs,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    version: "V11.3.0",
    approved: false,
    finalDecision: "WAIT",
    confidence: Math.max(0, averageConfidence - 25),
    averageConfidence,
    averageRiskScore,
    agreementScore,
    riskLevel,
    explanation:
      "Portfolio Brain found insufficient agreement. Waiting for stronger confirmation.",
    inputs,
    updatedAt: new Date().toISOString(),
  };
}