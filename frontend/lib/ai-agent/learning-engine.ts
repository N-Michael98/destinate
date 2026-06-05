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

    const portfolioRiskMemories = memory.filter((item) =>
      item.type.startsWith("PORTFOLIO_RISK")
    );

    const portfolioRiskBlocks = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_BLOCK"
    );

    const portfolioRiskReduced = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_REDUCED"
    );

    const portfolioRiskElevated = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_ELEVATED"
    );

    const portfolioRiskNormal = memory.filter(
      (item) => item.type === "PORTFOLIO_RISK_NORMAL"
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

    const portfolioRiskAccuracy =
      portfolioRiskMemories.length > 0
        ? Number(
            (
              ((portfolioRiskBlocks.length +
                portfolioRiskReduced.length +
                portfolioRiskElevated.length) /
                portfolioRiskMemories.length) *
              100
            ).toFixed(2)
          )
        : 0;

    const portfolioRiskScore =
      portfolioRiskMemories.length > 0
        ? Number(
            (
              portfolioRiskMemories.reduce(
                (sum, item) => sum + Number(item.riskScore ?? 0),
                0
              ) / portfolioRiskMemories.length
            ).toFixed(2)
          )
        : 0;

    const combinedMacroNewsScore =
      economicRiskMemories.length > 0 || newsRiskMemories.length > 0
        ? Number(
            (
              economicRiskScore * 0.55 +
              newsRiskScore * 0.45
            ).toFixed(2)
          )
        : 0;

    const macroNewsAccuracy =
      economicRiskMemories.length > 0 || newsRiskMemories.length > 0
        ? Number(
            (
              economicRiskAccuracy * 0.55 +
              newsRiskAccuracy * 0.45
            ).toFixed(2)
          )
        : 0;

    const combinedPortfolioMacroScore =
      economicRiskMemories.length > 0 ||
      newsRiskMemories.length > 0 ||
      portfolioRiskMemories.length > 0
        ? Number(
            (
              combinedMacroNewsScore * 0.65 +
              portfolioRiskScore * 0.35
            ).toFixed(2)
          )
        : 0;

    const portfolioLearningScore =
      portfolioRiskMemories.length > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                portfolioRiskAccuracy * 0.45 +
                  (100 - portfolioRiskScore) * 0.35 +
                  Number(stats.averageConfidence ?? 0) * 0.2
              )
            )
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
          Number(stats.averageConsensus ?? 0) * 0.25 +
            Number(stats.averageConfidence ?? 0) * 0.18 +
            averageRiskScore * 0.12 +
            economicRiskAccuracy * 0.18 +
            newsRiskAccuracy * 0.12 +
            portfolioRiskAccuracy * 0.15
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
                executionRate * 0.25 +
                  Number(stats.averageConsensus ?? 0) * 0.25 +
                  averageRiskScore * 0.12 +
                  economicRiskAccuracy * 0.13 +
                  newsRiskAccuracy * 0.1 +
                  portfolioRiskAccuracy * 0.15
              )
            )
          )
        : 0;

    let recommendedConfidence = Number(stats.averageConfidence ?? 0);

    if (
      learningScore >= 80 &&
      rejectionRate < 25 &&
      economicRiskAccuracy >= 70 &&
      newsRiskAccuracy >= 70 &&
      portfolioRiskAccuracy >= 70
    ) {
      recommendedConfidence = Math.min(95, recommendedConfidence + 3);
    }

    if (
      learningScore < 60 ||
      rejectionRate > 40 ||
      economicRiskAccuracy < 40 ||
      newsRiskAccuracy < 40 ||
      portfolioRiskAccuracy < 40
    ) {
      recommendedConfidence = Math.max(60, recommendedConfidence - 5);
    }

    let recommendation =
      "Agent behavior needs additional macro, news and portfolio learning.";

    if (
      learningScore >= 85 &&
      economicRiskAccuracy >= 75 &&
      newsRiskAccuracy >= 75 &&
      portfolioRiskAccuracy >= 75
    ) {
      recommendation =
        "Economic, news and portfolio risk decisions are performing well. Agent confidence may gradually increase.";
    } else if (
      learningScore >= 65 &&
      economicRiskAccuracy >= 50 &&
      newsRiskAccuracy >= 50 &&
      portfolioRiskAccuracy >= 50
    ) {
      recommendation =
        "Macro, news and portfolio risk integration is stable. Continue collecting memory and validating decisions.";
    } else {
      recommendation =
        "Macro/news/portfolio risk behavior requires more observations before increasing confidence.";
    }

    return {
      version: "V11.2.4",

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

      portfolioRiskMemories: portfolioRiskMemories.length,
      portfolioRiskBlocks: portfolioRiskBlocks.length,
      portfolioRiskReduced: portfolioRiskReduced.length,
      portfolioRiskElevated: portfolioRiskElevated.length,
      portfolioRiskNormal: portfolioRiskNormal.length,
      portfolioRiskAccuracy,
      portfolioRiskScore,

      averageNewsRisk: stats.averageNewsRisk ?? 0,
      averageEconomicRisk: stats.averageEconomicRisk ?? 0,
      averagePortfolioRisk: stats.averagePortfolioRisk ?? 0,

      combinedMacroNewsScore,
      macroNewsAccuracy,
      combinedPortfolioMacroScore,
      portfolioLearningScore,

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