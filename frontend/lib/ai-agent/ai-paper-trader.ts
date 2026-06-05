import { GPTAnalyst } from "./gpt-analyst";
import { ClaudeRisk } from "./claude-risk";
import { ConsensusEngine } from "./consensus-engine";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";
import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { StrategyEvolutionEngine } from "./strategy-evolution";
import { AdaptiveConfidenceEngine } from "./adaptive-confidence-engine";
import { generateEconomicCalendarReport } from "@/lib/economic-calendar";
import { NewsIntelligenceEngine } from "@/lib/news-intelligence/news-intelligence-engine";

function getEconomicMemoryType(tradingAction: string) {
  if (tradingAction === "NEWS_LOCKDOWN") return "ECONOMIC_RISK_BLOCK";
  if (tradingAction === "AVOID_NEW_POSITIONS") return "ECONOMIC_RISK_ELEVATED";
  if (tradingAction === "REDUCE_RISK") return "ECONOMIC_RISK_REDUCED";
  return "ECONOMIC_RISK_NORMAL";
}

function getNewsMemoryType(tradingAction: string) {
  if (tradingAction === "NEWS_LOCKDOWN") return "NEWS_RISK_BLOCK";
  if (tradingAction === "AVOID_NEW_POSITIONS") return "NEWS_RISK_ELEVATED";
  if (tradingAction === "REDUCE_RISK") return "NEWS_RISK_REDUCED";
  return "NEWS_RISK_NORMAL";
}

function getNewsTradingAction(marketRiskScore: number) {
  if (marketRiskScore >= 85) return "NEWS_LOCKDOWN";
  if (marketRiskScore >= 75) return "AVOID_NEW_POSITIONS";
  if (marketRiskScore >= 45) return "REDUCE_RISK";
  return "NORMAL_TRADING";
}

export class AIPaperTrader {
  static run() {
    const learning = AILearningEngine.analyze();
    const strategyEvolution = StrategyEvolutionEngine.analyze();
    const economicCalendar = generateEconomicCalendarReport();
    const newsIntelligence = NewsIntelligenceEngine.analyze();

    const bestStrategy = strategyEvolution.bestStrategy;

    const newsTradingAction = getNewsTradingAction(
      newsIntelligence.marketRiskScore
    );

    const adaptiveConfidence = AdaptiveConfidenceEngine.calculate({
      baseConfidence: 82,
      learningScore: learning.learningScore,
      agentAccuracy: learning.agentAccuracy,
      recommendedConfidence: learning.recommendedConfidence,
      strategyScore: bestStrategy.score,
      strategyBoost: bestStrategy.confidenceBoost,
      economicRiskScore: economicCalendar.riskScore,
      newsRiskScore: newsIntelligence.marketRiskScore,
      combinedMacroNewsScore: learning.combinedMacroNewsScore ?? 0,
      macroNewsAccuracy: learning.macroNewsAccuracy ?? 0,
    });

    const idea = GPTAnalyst.generateTradeIdea(
      adaptiveConfidence.adaptiveConfidence,
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

    const newsMemoryType = getNewsMemoryType(newsTradingAction);

    const economicRiskNote = `Economic Risk: ${economicCalendar.riskLevel} | Action: ${economicCalendar.tradingAction} | Score: ${economicCalendar.riskScore}`;

    const newsRiskNote = `News Risk: ${newsIntelligence.overallSentiment} | Action: ${newsTradingAction} | Score: ${newsIntelligence.marketRiskScore}`;

    const hardBlock =
      economicCalendar.tradingAction === "NEWS_LOCKDOWN" ||
      newsTradingAction === "NEWS_LOCKDOWN" ||
      adaptiveConfidence.adaptiveConfidence <= 0;

    if (hardBlock) {
      const economicMemory = AgentMemory.add({
        type: economicMemoryType,
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: 0,
        riskScore: economicCalendar.riskScore,
        reason:
          "AI paper trade blocked by Economic Calendar risk layer.",
        payload: {
          idea,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          newsTradingAction,
          adaptiveConfidence,
        },
      });

      const newsMemory = AgentMemory.add({
        type: newsMemoryType,
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: 0,
        riskScore: newsIntelligence.marketRiskScore,
        reason:
          "AI paper trade blocked or reduced by News Intelligence risk layer.",
        payload: {
          idea,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          newsTradingAction,
          adaptiveConfidence,
        },
      });

      const memory = AgentMemory.add({
        type: "AI_TRADE_REJECTED",
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: 0,
        riskScore: Math.max(
          economicCalendar.riskScore,
          newsIntelligence.marketRiskScore
        ),
        reason:
          "AI paper trade blocked by Adaptive Confidence Engine and combined Economic Calendar / News Intelligence risk layer.",
        payload: {
          idea,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          newsTradingAction,
          economicMemory,
          newsMemory,
          adaptiveConfidence,
        },
      });

      return {
        ok: true,
        executed: false,
        idea,
        risk: {
          source: "Adaptive Confidence + Combined Risk Layer",
          approved: false,
          riskScore: Math.max(
            economicCalendar.riskScore,
            newsIntelligence.marketRiskScore
          ),
          maxRiskPercent: 0,
          reason:
            "Trade blocked because adaptive confidence or combined macro/news risk requires protection.",
        },
        consensus: {
          source: "Adaptive Confidence + Combined Risk Layer",
          approved: false,
          score: 0,
          reason:
            "Consensus blocked before execution due to adaptive confidence and combined macro/news risk.",
        },
        learning,
        strategyEvolution,
        economicCalendar,
        newsIntelligence,
        newsTradingAction,
        adaptiveConfidence,
        economicMemory,
        newsMemory,
        memory,
        message:
          "AI paper trade blocked by Adaptive Confidence Engine and combined Economic Calendar / News Intelligence risk.",
      };
    }

    const risk = ClaudeRisk.validateTrade(idea);
    const consensus = ConsensusEngine.decide(idea, risk);

    if (!consensus.approved) {
      const newsMemory = AgentMemory.add({
        type: newsMemoryType,
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: consensus.score,
        riskScore: newsIntelligence.marketRiskScore,
        reason: `News intelligence risk processed before rejected decision: ${newsIntelligence.overallSentiment} / ${newsTradingAction}.`,
        payload: {
          idea,
          risk,
          consensus,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          newsTradingAction,
          adaptiveConfidence,
        },
      });

      const memory = AgentMemory.add({
        type: "AI_TRADE_REJECTED",
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: consensus.score,
        riskScore: Math.max(
          risk.riskScore,
          economicCalendar.riskScore,
          newsIntelligence.marketRiskScore
        ),
        reason: `${consensus.reason} | ${economicRiskNote} | ${newsRiskNote} | ${adaptiveConfidence.reason}`,
        payload: {
          idea,
          risk,
          consensus,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          newsTradingAction,
          newsMemory,
          adaptiveConfidence,
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
        newsIntelligence,
        newsTradingAction,
        adaptiveConfidence,
        newsMemory,
        memory,
        message:
          "AI paper trade rejected by consensus with adaptive confidence, economic risk and news risk included.",
      };
    }

    const orderSize =
      economicCalendar.tradingAction === "AVOID_NEW_POSITIONS" ||
      newsTradingAction === "AVOID_NEW_POSITIONS"
        ? 0.25
        : economicCalendar.tradingAction === "REDUCE_RISK" ||
            newsTradingAction === "REDUCE_RISK"
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
        newsIntelligence,
        newsTradingAction,
        adaptiveConfidence,
        orderSize,
      },
    });

    const newsMemory = AgentMemory.add({
      type: newsMemoryType,
      symbol: idea.symbol,
      direction: idea.direction,
      confidence: idea.confidence,
      approved: true,
      executed: false,
      consensusScore: consensus.score,
      riskScore: newsIntelligence.marketRiskScore,
      reason: `News intelligence risk processed before execution: ${newsIntelligence.overallSentiment} / ${newsTradingAction}.`,
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        economicCalendar,
        newsIntelligence,
        newsTradingAction,
        adaptiveConfidence,
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
      `${idea.reason} | ${risk.reason} | ${consensus.reason} | ${economicRiskNote} | ${newsRiskNote} | ${adaptiveConfidence.reason}`,
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
      riskScore: Math.max(
        risk.riskScore,
        economicCalendar.riskScore,
        newsIntelligence.marketRiskScore
      ),
      reason:
        "AI paper trade executed with Adaptive Confidence Engine, strategy selection, economic risk layer, news intelligence layer and stored in memory.",
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        economicCalendar,
        newsIntelligence,
        newsTradingAction,
        adaptiveConfidence,
        economicMemory,
        newsMemory,
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
      newsIntelligence,
      newsTradingAction,
      adaptiveConfidence,
      economicMemory,
      newsMemory,
      execution,
      memory,
      message:
        "AI paper trade executed successfully with Adaptive Confidence Engine, economic risk and news risk integration.",
    };
  }
}