type AdaptiveConfidenceInput = {
  baseConfidence: number;
  learningScore: number;
  agentAccuracy: number;
  recommendedConfidence: number;
  strategyScore: number;
  strategyBoost: number;
  economicRiskScore: number;
  newsRiskScore: number;
  combinedMacroNewsScore: number;
  macroNewsAccuracy: number;
};

export class AdaptiveConfidenceEngine {
  static calculate(input: AdaptiveConfidenceInput) {
    const learningBoost =
      input.learningScore >= 80
        ? 4
        : input.learningScore >= 65
          ? 2
          : input.learningScore < 50
            ? -5
            : 0;

    const accuracyBoost =
      input.agentAccuracy >= 75
        ? 3
        : input.agentAccuracy >= 60
          ? 1
          : input.agentAccuracy < 45
            ? -4
            : 0;

    const strategyBoost =
      input.strategyScore >= 85
        ? input.strategyBoost + 3
        : input.strategyScore >= 70
          ? input.strategyBoost + 1
          : input.strategyScore < 55
            ? -3
            : input.strategyBoost;

    const macroPenalty =
      input.combinedMacroNewsScore >= 85
        ? 25
        : input.combinedMacroNewsScore >= 70
          ? 12
          : input.combinedMacroNewsScore >= 45
            ? 6
            : 0;

    const economicPenalty =
      input.economicRiskScore >= 85
        ? 20
        : input.economicRiskScore >= 65
          ? 10
          : input.economicRiskScore >= 35
            ? 4
            : 0;

    const newsPenalty =
      input.newsRiskScore >= 85
        ? 18
        : input.newsRiskScore >= 75
          ? 10
          : input.newsRiskScore >= 45
            ? 5
            : 0;

    const macroAccuracyBoost =
      input.macroNewsAccuracy >= 80
        ? 2
        : input.macroNewsAccuracy >= 60
          ? 1
          : 0;

    const totalBoost =
      learningBoost +
      accuracyBoost +
      strategyBoost +
      macroAccuracyBoost;

    const totalPenalty =
      macroPenalty + economicPenalty + newsPenalty;

    const rawConfidence =
      input.recommendedConfidence + totalBoost - totalPenalty;

    const adaptiveConfidence = Math.min(
      95,
      Math.max(0, Number(rawConfidence.toFixed(2)))
    );

    const confidenceDelta = Number(
      (adaptiveConfidence - input.recommendedConfidence).toFixed(2)
    );

    const confidenceState =
      adaptiveConfidence >= 75
        ? "AGGRESSIVE"
        : adaptiveConfidence >= 50
          ? "BALANCED"
          : adaptiveConfidence >= 25
            ? "DEFENSIVE"
            : "LOCKDOWN";

    return {
      version: "V11.1.6",
      baseConfidence: input.baseConfidence,
      recommendedConfidence: input.recommendedConfidence,
      adaptiveConfidence,
      rawConfidence: Number(rawConfidence.toFixed(2)),
      confidenceDelta,
      confidenceState,
      learningBoost,
      accuracyBoost,
      strategyBoost,
      macroAccuracyBoost,
      totalBoost,
      macroPenalty,
      economicPenalty,
      newsPenalty,
      totalPenalty,
      combinedMacroNewsScore: input.combinedMacroNewsScore,
      macroNewsAccuracy: input.macroNewsAccuracy,
      reason:
        `Adaptive confidence calculated from learning, strategy strength, economic risk and news risk. State: ${confidenceState}. Final confidence: ${adaptiveConfidence}.`,
      updatedAt: new Date().toISOString(),
    };
  }
}
