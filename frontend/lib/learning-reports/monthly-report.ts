import type { LearningReport } from "./report-types";
import { getConsensusReview } from "./consensus-review";

export function getMonthlyReport(): LearningReport {
  const consensus = getConsensusReview();

  return {
    period: "MONTHLY",
    trades: 60,
    winrate: 62,
    bestStrategy: "Momentum Breakout",
    weakestStrategy: "Inventory Reaction",
    consensusScore: consensus.score,
  };
}