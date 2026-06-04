import { GPTAnalyst } from "./gpt-analyst";
import { ClaudeRisk } from "./claude-risk";
import { ConsensusEngine } from "./consensus-engine";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";
import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { StrategyEvolutionEngine } from "./strategy-evolution";

export class AIPaperTrader {
  static run() {
    const learning =
      AILearningEngine.analyze();

    const strategyEvolution =
      StrategyEvolutionEngine.analyze();

    const bestStrategy =
      strategyEvolution.bestStrategy;

    const idea =
      GPTAnalyst.generateTradeIdea(
        learning.recommendedConfidence,
        {
          id: bestStrategy.id,
          name: bestStrategy.name,
          type: bestStrategy.type,
          score: bestStrategy.score,
          confidenceBoost:
            bestStrategy.confidenceBoost,
          status: bestStrategy.status,
        }
      );

    const risk =
      ClaudeRisk.validateTrade(idea);

    const consensus =
      ConsensusEngine.decide(idea, risk);

    if (!consensus.approved) {
      const memory = AgentMemory.add({
        type: "AI_TRADE_REJECTED",
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: consensus.score,
        riskScore: risk.riskScore,
        reason: consensus.reason,
        payload: {
          idea,
          risk,
          consensus,
          learning,
          strategyEvolution,
        },
      });

      return {
        ok: true,
        executed: false,
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        memory,
        message:
          "AI paper trade rejected by consensus.",
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

    const memory = AgentMemory.add({
      type: "AI_TRADE_EXECUTED",
      symbol: idea.symbol,
      direction: idea.direction,
      confidence: idea.confidence,
      approved: true,
      executed: true,
      consensusScore: consensus.score,
      riskScore: risk.riskScore,
      reason:
        "AI paper trade executed with strategy selection, adaptive confidence and stored in memory.",
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        execution,
      },
    });

    return {
      ok: true,
      executed: true,
      idea,
      risk,
      consensus,
      learning,
      strategyEvolution,
      execution,
      memory,
      message:
        "AI paper trade executed successfully with strategy selection.",
    };
  }
}