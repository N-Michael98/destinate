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

    const rawConfidence =
      input.recommendedConfidence +
      learningBoost +
      accuracyBoost +
      strategyBoost +
      macroAccuracyBoost -
      macroPenalty -
      economicPenalty -
      newsPenalty;

    const adaptiveConfidence = Math.min(
      95,
      Math.max(0, Number(rawConfidence.toFixed(2)))
    );

    return {
      version: "V11.1.5",
      baseConfidence: input.baseConfidence,
      recommendedConfidence: input.recommendedConfidence,
      adaptiveConfidence,
      learningBoost,
      accuracyBoost,
      strategyBoost,
      macroAccuracyBoost,
      macroPenalty,
      economicPenalty,
      newsPenalty,
      totalPenalty: macroPenalty + economicPenalty + newsPenalty,
      combinedMacroNewsScore: input.combinedMacroNewsScore,
      macroNewsAccuracy: input.macroNewsAccuracy,
      reason:
        `Adaptive confidence calculated from learning, strategy strength, economic risk and news risk. Final confidence: ${adaptiveConfidence}.`,
      updatedAt: new Date().toISOString(),
    };
  }
}