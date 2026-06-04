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
    const memory =
      AgentMemory.getAll() as LearningMemoryEntry[];

    const stats = AgentMemory.getStats();

    const executed = memory.filter(
      (item) => item.type === "AI_TRADE_EXECUTED"
    );

    const rejected = memory.filter(
      (item) => item.type === "AI_TRADE_REJECTED"
    );

    const economicRiskMemories = memory.filter(
      (item) =>
        item.type === "ECONOMIC_RISK_BLOCK" ||
        item.type === "ECONOMIC_RISK_REDUCED" ||
        item.type === "ECONOMIC_RISK_ELEVATED" ||
        item.type === "ECONOMIC_RISK_NORMAL"
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
                (sum, item) =>
                  sum + Number(item.riskScore ?? 0),
                0
              ) / economicRiskMemories.length
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
          Number(stats.averageConsensus ?? 0) * 0.35 +
            Number(stats.averageConfidence ?? 0) * 0.25 +
            averageRiskScore * 0.15 +
            economicRiskAccuracy * 0.25
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
                executionRate * 0.35 +
                  Number(stats.averageConsensus ?? 0) * 0.35 +
                  averageRiskScore * 0.15 +
                  economicRiskAccuracy * 0.15
              )
            )
          )
        : 0;

    let recommendedConfidence =
      Number(stats.averageConfidence ?? 0);

    if (
      learningScore >= 80 &&
      rejectionRate < 25 &&
      economicRiskAccuracy >= 70
    ) {
      recommendedConfidence = Math.min(
        95,
        recommendedConfidence + 3
      );
    }

    if (
      learningScore < 60 ||
      rejectionRate > 40 ||
      economicRiskAccuracy < 40
    ) {
      recommendedConfidence = Math.max(
        60,
        recommendedConfidence - 5
      );
    }

    let recommendation =
      "Agent behavior needs additional learning.";

    if (
      learningScore >= 85 &&
      economicRiskAccuracy >= 75
    ) {
      recommendation =
        "Economic risk decisions are performing well. Agent confidence may gradually increase.";
    } else if (
      learningScore >= 65 &&
      economicRiskAccuracy >= 50
    ) {
      recommendation =
        "Economic risk integration is stable. Continue collecting memory and validating decisions.";
    } else {
      recommendation =
        "Economic risk behavior requires more observations before increasing confidence.";
    }

    return {
      version: "V11.0.9",

      totalMemories: total,

      executedTrades: executed.length,
      rejectedTrades: rejected.length,

      executionRate,
      rejectionRate,

      economicRiskMemories:
        economicRiskMemories.length,

      economicRiskBlocks:
        economicRiskBlocks.length,

      economicRiskReduced:
        economicRiskReduced.length,

      economicRiskElevated:
        economicRiskElevated.length,

      economicRiskNormal:
        economicRiskNormal.length,

      economicRiskAccuracy,
      economicRiskScore,

      averageConfidence:
        stats.averageConfidence,

      averageConsensus:
        stats.averageConsensus,

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