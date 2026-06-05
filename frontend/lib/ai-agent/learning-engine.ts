import { AgentMemory } from "./memory/agent-memory";

type LearningMemoryEntry = {
  type: string;
  confidence?: number;
  consensusScore?: number;
  riskScore?: number;
  executed?: boolean;
  approved?: boolean;
};

export class AILearningEngine {
  static analyze() {
    const memory = AgentMemory.getAll() as LearningMemoryEntry[];

    const stats = AgentMemory.getStats();

    const executed = memory.filter(
      (item) => item.type === "AI_TRADE_EXECUTED"
    );

    const rejected = memory.filter(
      (item) => item.type === "AI_TRADE_REJECTED"
    );

    const economicRiskMemories = memory.filter((item) =>
      item.type.startsWith("ECONOMIC_RISK")
    );

    const economicRiskBlocks = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_BLOCK"
    );

    const economicRiskReduced = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_REDUCED"
    );

    const economicRiskElevated = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_ELEVATED"
    );

    const economicRiskNormal = memory.filter(
      (item) => item.type === "ECONOMIC_RISK_NORMAL"
    );

    const newsRiskMemories = memory.filter((item) =>
      item.type.startsWith("NEWS_RISK")
    );

    const newsRiskBlocks = memory.filter(
      (item) => item.type === "NEWS_RISK_BLOCK"
    );

    const newsRiskReduced = memory.filter(
      (item) => item.type === "NEWS_RISK_REDUCED"
    );

    const newsRiskElevated = memory.filter(
      (item) => item.type === "NEWS_RISK_ELEVATED"
    );

    const newsRiskNormal = memory.filter(
      (item) => item.type === "NEWS_RISK_NORMAL"
    );

    const total = memory.length;

    const executionRate =
      total > 0
        ? Number(((executed.length / total) * 100).toFixed(2))
        : 0;

    const rejectionRate =
      total > 0
        ? Number(((rejected.length / total) * 100).toFixed(2))
        : 0;

    const averageRiskScore =
      total > 0
        ? Number(
            (
              memory.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / total
            ).toFixed(2)
          )
        : 0;

    const economicRiskAccuracy =
      economicRiskMemories.length > 0
        ? Number(
            (
              ((economicRiskBlocks.length +
                economicRiskReduced.length +
                economicRiskElevated.length) /
                economicRiskMemories.length) *
              100
            ).toFixed(2)
          )
        : 0;

    const economicRiskScore =
      economicRiskMemories.length > 0
        ? Number(
            (
              economicRiskMemories.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / economicRiskMemories.length
            ).toFixed(2)
          )
        : 0;

    const newsRiskAccuracy =
      newsRiskMemories.length > 0
        ? Number(
            (
              ((newsRiskBlocks.length +
                newsRiskReduced.length +
                newsRiskElevated.length) /
                newsRiskMemories.length) *
              100
            ).toFixed(2)
          )
        : 0;

    const newsRiskScore =
      newsRiskMemories.length > 0
        ? Number(
            (
              newsRiskMemories.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / newsRiskMemories.length
            ).toFixed(2)
          )
        : 0;

    const combinedMacroNewsScore =
      economicRiskMemories.length > 0 || newsRiskMemories.length > 0
        ? Number(
            (
              (economicRiskScore * 0.55) +
              (newsRiskScore * 0.45)
            ).toFixed(2)
          )
        : 0;

    const macroNewsAccuracy =
      economicRiskMemories.length > 0 || newsRiskMemories.length > 0
        ? Number(
            (
              (economicRiskAccuracy * 0.55) +
              (newsRiskAccuracy * 0.45)
            ).toFixed(2)
          )
        : 0;

    const confidenceGap = Number(
      (
        Number(stats.averageConfidence ?? 0) -
        Number(stats.averageConsensus ?? 0)
      ).toFixed(2)
    );

    const learningScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          Number(stats.averageConsensus ?? 0) * 0.3 +
            Number(stats.averageConfidence ?? 0) * 0.2 +
            averageRiskScore * 0.15 +
            economicRiskAccuracy * 0.2 +
            newsRiskAccuracy * 0.15
        )
      )
    );

    const agentAccuracy =
      total > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                executionRate * 0.3 +
                  Number(stats.averageConsensus ?? 0) * 0.3 +
                  averageRiskScore * 0.15 +
                  economicRiskAccuracy * 0.15 +
                  newsRiskAccuracy * 0.1
              )
            )
          )
        : 0;

    let recommendedConfidence = Number(stats.averageConfidence ?? 0);

    if (
      learningScore >= 80 &&
      rejectionRate < 25 &&
      economicRiskAccuracy >= 70 &&
      newsRiskAccuracy >= 70
    ) {
      recommendedConfidence = Math.min(95, recommendedConfidence + 3);
    }

    if (
      learningScore < 60 ||
      rejectionRate > 40 ||
      economicRiskAccuracy < 40 ||
      newsRiskAccuracy < 40
    ) {
      recommendedConfidence = Math.max(60, recommendedConfidence - 5);
    }

    let recommendation =
      "Agent behavior needs additional macro and news learning.";

    if (
      learningScore >= 85 &&
      economicRiskAccuracy >= 75 &&
      newsRiskAccuracy >= 75
    ) {
      recommendation =
        "Economic and news risk decisions are performing well. Agent confidence may gradually increase.";
    } else if (
      learningScore >= 65 &&
      economicRiskAccuracy >= 50 &&
      newsRiskAccuracy >= 50
    ) {
      recommendation =
        "Macro and news risk integration is stable. Continue collecting memory and validating decisions.";
    } else {
      recommendation =
        "Macro/news risk behavior requires more observations before increasing confidence.";
    }

    return {
      version: "V11.1.3",

      totalMemories: total,

      executedTrades: executed.length,
      rejectedTrades: rejected.length,

      executionRate,
      rejectionRate,

      economicRiskMemories: economicRiskMemories.length,
      economicRiskBlocks: economicRiskBlocks.length,
      economicRiskReduced: economicRiskReduced.length,
      economicRiskElevated: economicRiskElevated.length,
      economicRiskNormal: economicRiskNormal.length,
      economicRiskAccuracy,
      economicRiskScore,

      newsRiskMemories: newsRiskMemories.length,
      newsRiskBlocks: newsRiskBlocks.length,
      newsRiskReduced: newsRiskReduced.length,
      newsRiskElevated: newsRiskElevated.length,
      newsRiskNormal: newsRiskNormal.length,
      newsRiskAccuracy,
      newsRiskScore,

      averageNewsRisk: stats.averageNewsRisk ?? 0,
      averageEconomicRisk: stats.averageEconomicRisk ?? 0,

      combinedMacroNewsScore,
      macroNewsAccuracy,

      averageConfidence: stats.averageConfidence,
      averageConsensus: stats.averageConsensus,
      averageRiskScore,

      confidenceGap,

      learningScore,
      agentAccuracy,

      recommendedConfidence,

      recommendation,

      status: "analyzed",

      updatedAt: new Date().toISOString(),
    };
  }
}