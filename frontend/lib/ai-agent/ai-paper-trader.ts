import { GPTAnalyst } from "./gpt-analyst";
import { ClaudeRisk } from "./claude-risk";
import { ConsensusEngine } from "./consensus-engine";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";
import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { StrategyEvolutionEngine } from "./strategy-evolution";
import { generateEconomicCalendarReport } from "@/lib/economic-calendar";

function getEconomicConfidencePenalty(tradingAction: string): number {
  if (tradingAction === "NEWS_LOCKDOWN") return 100;
  if (tradingAction === "AVOID_NEW_POSITIONS") return 10;
  if (tradingAction === "REDUCE_RISK") return 5;
  return 0;
}

function getEconomicMemoryType(tradingAction: string) {
  if (tradingAction === "NEWS_LOCKDOWN") return "ECONOMIC_RISK_BLOCK";
  if (tradingAction === "AVOID_NEW_POSITIONS") return "ECONOMIC_RISK_ELEVATED";
  if (tradingAction === "REDUCE_RISK") return "ECONOMIC_RISK_REDUCED";
  return "ECONOMIC_RISK_NORMAL";
}

export class AIPaperTrader {
  static run() {
    const learning = AILearningEngine.analyze();

    const strategyEvolution = StrategyEvolutionEngine.analyze();

    const economicCalendar = generateEconomicCalendarReport();

    const economicPenalty = getEconomicConfidencePenalty(
      economicCalendar.tradingAction
    );

    const bestStrategy = strategyEvolution.bestStrategy;

    const idea = GPTAnalyst.generateTradeIdea(
      Math.max(0, learning.recommendedConfidence - economicPenalty),
      {
        id: bestStrategy.id,
        name: bestStrategy.name,
        type: bestStrategy.type,
        score: bestStrategy.score,
        confidenceBoost: bestStrategy.confidenceBoost,
        status: bestStrategy.status,
      }
    );

    const economicMemoryType = getEconomicMemoryType(
      economicCalendar.tradingAction
    );

    const economicRiskNote = `Economic Risk: ${economicCalendar.riskLevel} | Action: ${economicCalendar.tradingAction} | Score: ${economicCalendar.riskScore}`;

    if (economicCalendar.tradingAction === "NEWS_LOCKDOWN") {
      const memory = AgentMemory.add({
        type: economicMemoryType,
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: 0,
        riskScore: economicCalendar.riskScore,
        reason:
          "AI paper trade blocked by Economic Calendar NEWS_LOCKDOWN.",
        payload: {
          idea,
          learning,
          strategyEvolution,
          economicCalendar,
        },
      });

      return {
        ok: true,
        executed: false,
        idea,
        risk: {
          source: "Economic Calendar Risk Layer",
          approved: false,
          riskScore: economicCalendar.riskScore,
          maxRiskPercent: 0,
          reason:
            "Trade blocked because economic calendar risk is EXTREME / NEWS_LOCKDOWN.",
        },
        consensus: {
          source: "Economic Calendar Risk Layer",
          approved: false,
          score: 0,
          reason:
            "Consensus blocked before execution due to NEWS_LOCKDOWN.",
        },
        learning,
        strategyEvolution,
        economicCalendar,
        memory,
        message:
          "AI paper trade blocked by Economic Calendar NEWS_LOCKDOWN.",
      };
    }

    const risk = ClaudeRisk.validateTrade(idea);

    const consensus = ConsensusEngine.decide(idea, risk);

    if (!consensus.approved) {
      const memory = AgentMemory.add({
        type: "AI_TRADE_REJECTED",
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: consensus.score,
        riskScore: Math.max(risk.riskScore, economicCalendar.riskScore),
        reason: `${consensus.reason} | ${economicRiskNote}`,
        payload: {
          idea,
          risk,
          consensus,
          learning,
          strategyEvolution,
          economicCalendar,
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
        economicCalendar,
        memory,
        message:
          "AI paper trade rejected by consensus with economic calendar risk included.",
      };
    }

    const orderSize =
      economicCalendar.tradingAction === "AVOID_NEW_POSITIONS"
        ? 0.25
        : economicCalendar.tradingAction === "REDUCE_RISK"
          ? 0.5
          : 1;

    const economicMemory = AgentMemory.add({
      type: economicMemoryType,
      symbol: idea.symbol,
      direction: idea.direction,
      confidence: idea.confidence,
      approved: true,
      executed: false,
      consensusScore: consensus.score,
      riskScore: economicCalendar.riskScore,
      reason: `Economic calendar risk processed before execution: ${economicCalendar.riskLevel} / ${economicCalendar.tradingAction}.`,
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        economicCalendar,
        orderSize,
      },
    });

    const execution = paperTradingManager.createAndFillPaperOrder(
      idea.symbol,
      idea.direction,
      idea.entry,
      idea.stopLoss,
      idea.takeProfit1,
      idea.takeProfit2,
      idea.confidence,
      `${idea.reason} | ${risk.reason} | ${consensus.reason} | ${economicRiskNote}`,
      orderSize
    );

    const memory = AgentMemory.add({
      type: "AI_TRADE_EXECUTED",
      symbol: idea.symbol,
      direction: idea.direction,
      confidence: idea.confidence,
      approved: true,
      executed: true,
      consensusScore: consensus.score,
      riskScore: Math.max(risk.riskScore, economicCalendar.riskScore),
      reason:
        "AI paper trade executed with strategy selection, adaptive confidence, economic risk layer and stored in memory.",
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        economicCalendar,
        economicMemory,
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
      economicCalendar,
      economicMemory,
      execution,
      memory,
      message:
        "AI paper trade executed successfully with strategy selection and economic risk integration.",
    };
  }
}