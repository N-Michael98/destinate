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

    const confidenceGap =
      Number(
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
          Number(stats.averageConsensus ?? 0) * 0.45 +
            Number(stats.averageConfidence ?? 0) * 0.35 +
            averageRiskScore * 0.2
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
                executionRate * 0.4 +
                  Number(stats.averageConsensus ?? 0) * 0.4 +
                  averageRiskScore * 0.2
              )
            )
          )
        : 0;

    let recommendedConfidence =
      Number(stats.averageConfidence ?? 0);

    if (learningScore >= 80 && rejectionRate < 25) {
      recommendedConfidence = Math.min(
        95,
        recommendedConfidence + 3
      );
    }

    if (learningScore < 60 || rejectionRate > 40) {
      recommendedConfidence = Math.max(
        60,
        recommendedConfidence - 5
      );
    }

    const recommendation =
      learningScore >= 80
        ? "Agent behavior is stable. Confidence can be increased carefully."
        : learningScore >= 60
          ? "Agent behavior is acceptable. Keep confidence stable and collect more memory."
          : "Agent behavior needs review. Reduce confidence and require stricter consensus.";

    return {
      version: "V10.3.4",
      totalMemories: total,
      executedTrades: executed.length,
      rejectedTrades: rejected.length,
      executionRate,
      rejectionRate,
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