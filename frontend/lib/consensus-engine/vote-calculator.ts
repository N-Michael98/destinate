import { ConsensusVote } from "./consensus-types";

export class VoteCalculator {
  static calculate(votes: ConsensusVote[]): ConsensusVote {
    const reject = votes.filter((vote) => vote === "REJECT").length;
    const buy = votes.filter((vote) => vote === "BUY").length;
    const sell = votes.filter((vote) => vote === "SELL").length;

    if (reject >= 1) return "REJECT";
    if (buy >= 3) return "BUY";
    if (sell >= 3) return "SELL";

    return "WAIT";
  }
}