import { ConsensusVote } from "./consensus-types";

export function calculateConsensusConfidence(
  votes: ConsensusVote[],
  gptConfidence: number,
  claudeApproved: boolean
): number {
  const alignedVotes = votes.filter(
    (vote) => vote === "BUY" || vote === "SELL"
  ).length;

  const base = Math.round((alignedVotes / votes.length) * 100);
  const gptWeight = Math.round(gptConfidence * 0.2);
  const claudeBonus = claudeApproved ? 10 : -30;

  return Math.max(0, Math.min(100, Math.round(base * 0.7 + gptWeight + claudeBonus)));
}