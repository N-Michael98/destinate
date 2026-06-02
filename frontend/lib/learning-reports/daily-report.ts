import type { LearningReport } from "./report-types";
import { getConsensusReview } from "./consensus-review";

export function getDailyReport(): LearningReport {
  const consensus = getConsensusReview();

  return {
    period: "DAILY",
    trades: 3,
    winrate: 67,
    bestStrategy: "Momentum Breakout",
    weakestStrategy: "Inventory Reaction",
    consensusScore: consensus.score,
  };
}