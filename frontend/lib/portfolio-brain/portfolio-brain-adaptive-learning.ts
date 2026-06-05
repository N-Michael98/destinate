import { buildPortfolioBrainLearningReport } from "./portfolio-brain-learning";
import { buildPortfolioBrainOutcomeReport } from "./portfolio-brain-outcomes";

export type PortfolioBrainAdaptiveLearningReport = {
  version: string;
  status: "READY";
  baseConfidence: number;
  adaptiveConfidence: number;
  confidenceAdjustment: number;
  baseRiskScore: number;
  adaptiveRiskScore: number;
  riskAdjustment: number;
  learningScore: number;
  outcomeQualityScore: number;
  winRate: number;
  averagePnlPercent: number;
  sampleSize: number;
  adaptiveState: "CAUTIOUS" | "BALANCED" | "CONFIDENT";
  recommendation: string;
  updatedAt: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildPortfolioBrainAdaptiveLearningReport(): PortfolioBrainAdaptiveLearningReport {
  const learning = buildPortfolioBrainLearningReport();
  const outcomes = buildPortfolioBrainOutcomeReport();

  const baseConfidence = learning.averageConfidence;
  const baseRiskScore = learning.averageRiskScore;

  const learningAdjustment =
    learning.learningScore >= 75 ? 10 : learning.learningScore >= 50 ? 4 : -8;

  const outcomeAdjustment =
    outcomes.outcomeQualityScore >= 75
      ? 10
      : outcomes.outcomeQualityScore >= 50
        ? 3
        : -7;

  const winRateAdjustment =
    outcomes.winRate >= 60 ? 6 : outcomes.winRate >= 45 ? 2 : -4;

  const pnlAdjustment =
    outcomes.averagePnlPercent > 0.5
      ? 5
      : outcomes.averagePnlPercent > 0
        ? 2
        : outcomes.averagePnlPercent < 0
          ? -5
          : 0;

  const sampleAdjustment =
    learning.totalMemories >= 20
      ? 6
      : learning.totalMemories >= 10
        ? 3
        : learning.totalMemories >= 5
          ? 1
          : -4;

  const confidenceAdjustment =
    learningAdjustment +
    outcomeAdjustment +
    winRateAdjustment +
    pnlAdjustment +
    sampleAdjustment;

  const adaptiveConfidence = clamp(
    Math.round(baseConfidence + confidenceAdjustment),
    0,
    100
  );

  const riskAdjustment =
    adaptiveConfidence >= 75
      ? -10
      : adaptiveConfidence >= 55
        ? -4
        : 8;

  const adaptiveRiskScore = clamp(
    Math.round(baseRiskScore + riskAdjustment),
    0,
    100
  );

  const adaptiveState =
    adaptiveConfidence >= 75 && adaptiveRiskScore <= 45
      ? "CONFIDENT"
      : adaptiveConfidence >= 50 && adaptiveRiskScore <= 65
        ? "BALANCED"
        : "CAUTIOUS";

  const recommendation =
    adaptiveState === "CONFIDENT"
      ? "Portfolio Brain adaptive learning is confident. Continue simulation validation before enabling advanced execution logic."
      : adaptiveState === "BALANCED"
        ? "Portfolio Brain adaptive learning is balanced. Continue collecting outcomes and keep risk filters active."
        : "Portfolio Brain adaptive learning is cautious. Keep simulation mode active and collect more memory/outcome samples.";

  return {
    version: "V11.5.0",
    status: "READY",
    baseConfidence,
    adaptiveConfidence,
    confidenceAdjustment,
    baseRiskScore,
    adaptiveRiskScore,
    riskAdjustment,
    learningScore: learning.learningScore,
    outcomeQualityScore: outcomes.outcomeQualityScore,
    winRate: outcomes.winRate,
    averagePnlPercent: outcomes.averagePnlPercent,
    sampleSize: learning.totalMemories,
    adaptiveState,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}