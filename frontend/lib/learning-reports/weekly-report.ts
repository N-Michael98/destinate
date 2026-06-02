import type { LearningReport } from "./report-types";
import { getConsensusReview } from "./consensus-review";

export function getWeeklyReport(): LearningReport {
  const consensus = getConsensusReview();

  return {
    period: "WEEKLY",
    trades: 15,
    winrate: 64,
    bestStrategy: "Risk-Off Trend",
    weakestStrategy: "Inventory Reaction",
    consensusScore: consensus.score,
  };
}