import { GPTTradeIdea } from "./gpt-analyst";
import { ClaudeRiskDecision } from "./claude-risk";

export type ConsensusDecision = {
  source: "CONSENSUS_ENGINE";
  approved: boolean;
  score: number;
  reason: string;
};

export class ConsensusEngine {
  static decide(
    idea: GPTTradeIdea,
    risk: ClaudeRiskDecision
  ): ConsensusDecision {
    const approved =
      idea.confidence >= 70 &&
      risk.approved;

    const score = approved
      ? Math.round((idea.confidence + risk.riskScore) / 2)
      : Math.round((idea.confidence + risk.riskScore) / 3);

    return {
      source: "CONSENSUS_ENGINE",
      approved,
      score,
      reason: approved
        ? "Mock consensus approved: GPT idea and Claude risk check agree."
        : "Mock consensus rejected: GPT and Claude do not fully agree.",
    };
  }
}