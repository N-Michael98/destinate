import { GPTAnalyst } from "./gpt-analyst";
import { ClaudeRisk } from "./claude-risk";
import { ConsensusEngine } from "./consensus-engine";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";

export class AIPaperTrader {
  static run() {
    const idea = GPTAnalyst.generateTradeIdea();
    const risk = ClaudeRisk.validateTrade(idea);
    const consensus = ConsensusEngine.decide(idea, risk);

    if (!consensus.approved) {
      return {
        ok: true,
        executed: false,
        idea,
        risk,
        consensus,
        message: "AI paper trade rejected by consensus.",
      };
    }

    const execution =
      paperTradingManager.createAndFillPaperOrder(
        idea.symbol,
        idea.direction,
        idea.entry,
        idea.stopLoss,
        idea.takeProfit1,
        idea.takeProfit2,
        idea.confidence,
        `${idea.reason} | ${risk.reason} | ${consensus.reason}`,
        1
      );

    return {
      ok: true,
      executed: true,
      idea,
      risk,
      consensus,
      execution,
      message: "AI paper trade executed successfully.",
    };
  }
}