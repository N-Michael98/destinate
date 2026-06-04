import { ConsensusVote } from "./consensus-types";

export function validateTradePermission(
  finalVote: ConsensusVote,
  claudeApproved: boolean,
  confidence: number
): boolean {
  if (!claudeApproved) return false;
  if (finalVote === "REJECT") return false;
  if (finalVote === "WAIT") return false;
  if (confidence < 70) return false;

  return true;
}