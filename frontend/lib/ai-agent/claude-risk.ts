import { GPTTradeIdea } from "./gpt-analyst";

export type ClaudeRiskDecision = {
  source: "CLAUDE_RISK";
  approved: boolean;
  riskScore: number;
  maxRiskPercent: number;
  reason: string;
};

export class ClaudeRisk {
  static validateTrade(idea: GPTTradeIdea): ClaudeRiskDecision {
    const riskDistance = Math.abs(idea.entry - idea.stopLoss);
    const rewardDistance = Math.abs(idea.takeProfit1 - idea.entry);
    const rewardRiskRatio =
      riskDistance > 0 ? rewardDistance / riskDistance : 0;

    const approved =
      idea.confidence >= 70 &&
      rewardRiskRatio >= 1;

    return {
      source: "CLAUDE_RISK",
      approved,
      riskScore: approved ? 78 : 45,
      maxRiskPercent: 1,
      reason: approved
        ? "Mock Claude risk approval: confidence and reward/risk are acceptable."
        : "Mock Claude risk rejection: setup does not meet minimum risk criteria.",
    };
  }
}