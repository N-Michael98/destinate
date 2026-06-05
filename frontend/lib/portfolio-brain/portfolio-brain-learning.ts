import { getPortfolioBrainMemory } from "./portfolio-brain-memory";

export type PortfolioBrainLearningDecisionStats = {
  decision: string;
  count: number;
  averageConfidence: number;
  averageRiskScore: number;
};

export type PortfolioBrainLearningReport = {
  version: string;
  status: "READY";
  totalMemories: number;
  totalDecisions: number;
  waitDecisions: number;
  longDecisions: number;
  shortDecisions: number;
  blockDecisions: number;
  averageConfidence: number;
  averageRiskScore: number;
  bestDecisionType: string;
  worstDecisionType: string;
  learningScore: number;
  recommendation: string;
  decisionStats: PortfolioBrainLearningDecisionStats[];
  updatedAt: string;
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildPortfolioBrainLearningReport(): PortfolioBrainLearningReport {
  const memory = getPortfolioBrainMemory();

  const totalMemories = memory.length;
  const totalDecisions = memory.length;

  const waitDecisions = memory.filter((entry) => entry.decision === "WAIT").length;
  const longDecisions = memory.filter((entry) => entry.decision === "LONG").length;
  const shortDecisions = memory.filter((entry) => entry.decision === "SHORT").length;
  const blockDecisions = memory.filter((entry) => entry.decision === "BLOCK").length;

  const averageConfidence = average(memory.map((entry) => entry.confidence));
  const averageRiskScore = average(memory.map((entry) => entry.riskScore));

  const decisionTypes = ["WAIT", "LONG", "SHORT", "BLOCK"];

  const decisionStats = decisionTypes.map((decision) => {
    const entries = memory.filter((entry) => entry.decision === decision);

    return {
      decision,
      count: entries.length,
      averageConfidence: average(entries.map((entry) => entry.confidence)),
      averageRiskScore: average(entries.map((entry) => entry.riskScore)),
    };
  });

  const sortedByCount = [...decisionStats].sort((a, b) => b.count - a.count);
  const bestDecisionType = sortedByCount[0]?.count ? sortedByCount[0].decision : "UNKNOWN";
  const worstDecisionType =
    [...decisionStats].sort((a, b) => a.count - b.count).find((item) => item.count > 0)
      ?.decision ?? "UNKNOWN";

  const riskPenalty =
    averageRiskScore >= 70 ? 25 : averageRiskScore >= 50 ? 15 : averageRiskScore >= 35 ? 8 : 0;

  const confidenceBoost =
    averageConfidence >= 75 ? 20 : averageConfidence >= 60 ? 12 : averageConfidence >= 45 ? 6 : 0;

  const sampleBoost =
    totalMemories >= 20 ? 20 : totalMemories >= 10 ? 12 : totalMemories >= 5 ? 6 : 0;

  const learningScore = Math.max(
    0,
    Math.min(100, 50 + confidenceBoost + sampleBoost - riskPenalty)
  );

  const recommendation =
    totalMemories === 0
      ? "Portfolio Brain needs more memory entries before learning can evaluate decision quality."
      : learningScore >= 75
        ? "Portfolio Brain learning is strong. Continue collecting decisions and prepare outcome tracking."
        : learningScore >= 50
          ? "Portfolio Brain learning is stable but needs more observations before increasing confidence."
          : "Portfolio Brain learning is cautious. Keep simulation mode active and collect more decision history.";

  return {
    version: "V11.4.0",
    status: "READY",
    totalMemories,
    totalDecisions,
    waitDecisions,
    longDecisions,
    shortDecisions,
    blockDecisions,
    averageConfidence,
    averageRiskScore,
    bestDecisionType,
    worstDecisionType,
    learningScore,
    recommendation,
    decisionStats,
    updatedAt: new Date().toISOString(),
  };
}