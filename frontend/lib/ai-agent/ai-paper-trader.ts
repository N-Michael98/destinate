import { GPTAnalyst } from "./gpt-analyst";
import { ClaudeRisk } from "./claude-risk";
import { ConsensusEngine } from "./consensus-engine";
import { paperTradingManager } from "@/lib/paper-trading/paper-singleton";
import { AgentMemory } from "./memory/agent-memory";
import { AILearningEngine } from "./learning-engine";
import { StrategyEvolutionEngine } from "./strategy-evolution";
import { AdaptiveConfidenceEngine } from "./adaptive-confidence-engine";
import { generateEconomicCalendarReport } from "@/lib/economic-calendar";
import { NewsIntelligenceEngine } from "@/lib/news-intelligence/news-intelligence-engine";
import { getPortfolioIntelligenceReport } from "@/lib/portfolio-intelligence";

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

function getPortfolioMemoryType(portfolioRiskScore: number) {
  if (portfolioRiskScore >= 85) return "PORTFOLIO_RISK_BLOCK";
  if (portfolioRiskScore >= 70) return "PORTFOLIO_RISK_ELEVATED";
  if (portfolioRiskScore >= 45) return "PORTFOLIO_RISK_REDUCED";
  return "PORTFOLIO_RISK_NORMAL";
}

function getNewsTradingAction(marketRiskScore: number) {
  if (marketRiskScore >= 85) return "NEWS_LOCKDOWN";
  if (marketRiskScore >= 75) return "AVOID_NEW_POSITIONS";
  if (marketRiskScore >= 45) return "REDUCE_RISK";
  return "NORMAL_TRADING";
}

function getPortfolioTradingAction(
  portfolioRiskScore: number,
  portfolioHealth: number,
  concentrationScore: number
) {
  if (portfolioRiskScore >= 85 || portfolioHealth <= 35) {
    return "PORTFOLIO_LOCKDOWN";
  }

  if (portfolioRiskScore >= 70 || concentrationScore >= 75) {
    return "AVOID_NEW_POSITIONS";
  }

  if (portfolioRiskScore >= 45 || concentrationScore >= 55) {
    return "REDUCE_RISK";
  }

  return "NORMAL_TRADING";
}

export class AIPaperTrader {
  static run() {
    const learning = AILearningEngine.analyze();
    const strategyEvolution = StrategyEvolutionEngine.analyze();
    const economicCalendar = generateEconomicCalendarReport();
    const newsIntelligence = NewsIntelligenceEngine.analyze();
    const portfolioIntelligence = getPortfolioIntelligenceReport();

    const bestStrategy = strategyEvolution.bestStrategy;

    const newsTradingAction = getNewsTradingAction(
      newsIntelligence.marketRiskScore
    );

    const portfolioTradingAction = getPortfolioTradingAction(
      portfolioIntelligence.summary.portfolioRiskScore,
      portfolioIntelligence.summary.portfolioHealth,
      portfolioIntelligence.summary.concentrationScore
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

      portfolioRiskScore: portfolioIntelligence.summary.portfolioRiskScore,
      portfolioRiskAccuracy: learning.portfolioRiskAccuracy ?? 0,
      portfolioLearningScore: learning.portfolioLearningScore ?? 0,
      portfolioHealth: portfolioIntelligence.summary.portfolioHealth,
      diversificationScore:
        portfolioIntelligence.summary.diversificationScore,
      concentrationScore:
        portfolioIntelligence.summary.concentrationScore,
    });

    const portfolioConfidencePenalty =
      portfolioTradingAction === "PORTFOLIO_LOCKDOWN"
        ? 100
        : portfolioTradingAction === "AVOID_NEW_POSITIONS"
          ? 15
          : portfolioTradingAction === "REDUCE_RISK"
            ? 8
            : 0;

    const portfolioAdjustedConfidence = Math.max(
      0,
      Number(
        (
          adaptiveConfidence.adaptiveConfidence -
          portfolioConfidencePenalty
        ).toFixed(2)
      )
    );

    const idea = GPTAnalyst.generateTradeIdea(
      portfolioAdjustedConfidence,
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

    const portfolioMemoryType = getPortfolioMemoryType(
      portfolioIntelligence.summary.portfolioRiskScore
    );

    const economicRiskNote = `Economic Risk: ${economicCalendar.riskLevel} | Action: ${economicCalendar.tradingAction} | Score: ${economicCalendar.riskScore}`;

    const newsRiskNote = `News Risk: ${newsIntelligence.overallSentiment} | Action: ${newsTradingAction} | Score: ${newsIntelligence.marketRiskScore}`;

    const portfolioRiskNote = `Portfolio Risk: ${portfolioIntelligence.summary.portfolioRisk} | Action: ${portfolioTradingAction} | Score: ${portfolioIntelligence.summary.portfolioRiskScore} | Health: ${portfolioIntelligence.summary.portfolioHealth} | Concentration: ${portfolioIntelligence.summary.concentrationScore}`;

    const hardBlock =
      economicCalendar.tradingAction === "NEWS_LOCKDOWN" ||
      newsTradingAction === "NEWS_LOCKDOWN" ||
      portfolioTradingAction === "PORTFOLIO_LOCKDOWN" ||
      portfolioAdjustedConfidence <= 0;

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
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
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
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
        },
      });

      const portfolioMemory = AgentMemory.add({
        type: portfolioMemoryType,
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: 0,
        riskScore:
          portfolioIntelligence.summary.portfolioRiskScore,
        reason:
          "AI paper trade blocked or reduced by Portfolio Intelligence risk layer.",
        payload: {
          idea,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
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
          newsIntelligence.marketRiskScore,
          portfolioIntelligence.summary.portfolioRiskScore
        ),
        reason:
          "AI paper trade blocked by Adaptive Confidence Engine, Economic Calendar, News Intelligence and Portfolio Intelligence risk layers.",
        payload: {
          idea,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          economicMemory,
          newsMemory,
          portfolioMemory,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
        },
      });

      return {
        ok: true,
        executed: false,
        idea,
        risk: {
          source:
            "Adaptive Confidence + Economic + News + Portfolio Risk Layer",
          approved: false,
          riskScore: Math.max(
            economicCalendar.riskScore,
            newsIntelligence.marketRiskScore,
            portfolioIntelligence.summary.portfolioRiskScore
          ),
          maxRiskPercent: 0,
          reason:
            "Trade blocked because adaptive confidence, macro/news risk or portfolio risk requires protection.",
        },
        consensus: {
          source:
            "Adaptive Confidence + Economic + News + Portfolio Risk Layer",
          approved: false,
          score: 0,
          reason:
            "Consensus blocked before execution due to adaptive confidence, macro/news and portfolio protection.",
        },
        learning,
        strategyEvolution,
        economicCalendar,
        newsIntelligence,
        portfolioIntelligence,
        newsTradingAction,
        portfolioTradingAction,
        adaptiveConfidence,
        portfolioConfidencePenalty,
        portfolioAdjustedConfidence,
        economicMemory,
        newsMemory,
        portfolioMemory,
        memory,
        message:
          "AI paper trade blocked by Portfolio-aware Adaptive Confidence and combined risk layers.",
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
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
        },
      });

      const portfolioMemory = AgentMemory.add({
        type: portfolioMemoryType,
        symbol: idea.symbol,
        direction: idea.direction,
        confidence: idea.confidence,
        approved: false,
        executed: false,
        consensusScore: consensus.score,
        riskScore:
          portfolioIntelligence.summary.portfolioRiskScore,
        reason: `Portfolio intelligence risk processed before rejected decision: ${portfolioIntelligence.summary.portfolioRisk} / ${portfolioTradingAction}.`,
        payload: {
          idea,
          risk,
          consensus,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
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
          newsIntelligence.marketRiskScore,
          portfolioIntelligence.summary.portfolioRiskScore
        ),
        reason: `${consensus.reason} | ${economicRiskNote} | ${newsRiskNote} | ${portfolioRiskNote} | ${adaptiveConfidence.reason}`,
        payload: {
          idea,
          risk,
          consensus,
          learning,
          strategyEvolution,
          economicCalendar,
          newsIntelligence,
          portfolioIntelligence,
          newsTradingAction,
          portfolioTradingAction,
          newsMemory,
          portfolioMemory,
          adaptiveConfidence,
          portfolioConfidencePenalty,
          portfolioAdjustedConfidence,
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
        portfolioIntelligence,
        newsTradingAction,
        portfolioTradingAction,
        adaptiveConfidence,
        portfolioConfidencePenalty,
        portfolioAdjustedConfidence,
        newsMemory,
        portfolioMemory,
        memory,
        message:
          "AI paper trade rejected by consensus with adaptive confidence, economic risk, news risk and portfolio risk included.",
      };
    }

    const orderSize =
      economicCalendar.tradingAction === "AVOID_NEW_POSITIONS" ||
      newsTradingAction === "AVOID_NEW_POSITIONS" ||
      portfolioTradingAction === "AVOID_NEW_POSITIONS"
        ? 0.25
        : economicCalendar.tradingAction === "REDUCE_RISK" ||
            newsTradingAction === "REDUCE_RISK" ||
            portfolioTradingAction === "REDUCE_RISK"
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
        portfolioIntelligence,
        newsTradingAction,
        portfolioTradingAction,
        adaptiveConfidence,
        portfolioConfidencePenalty,
        portfolioAdjustedConfidence,
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
        portfolioIntelligence,
        newsTradingAction,
        portfolioTradingAction,
        adaptiveConfidence,
        portfolioConfidencePenalty,
        portfolioAdjustedConfidence,
        orderSize,
      },
    });

    const portfolioMemory = AgentMemory.add({
      type: portfolioMemoryType,
      symbol: idea.symbol,
      direction: idea.direction,
      confidence: idea.confidence,
      approved: true,
      executed: false,
      consensusScore: consensus.score,
      riskScore:
        portfolioIntelligence.summary.portfolioRiskScore,
      reason: `Portfolio intelligence risk processed before execution: ${portfolioIntelligence.summary.portfolioRisk} / ${portfolioTradingAction}.`,
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        economicCalendar,
        newsIntelligence,
        portfolioIntelligence,
        newsTradingAction,
        portfolioTradingAction,
        adaptiveConfidence,
        portfolioConfidencePenalty,
        portfolioAdjustedConfidence,
        orderSize,
      },
    });

    const execution =
      paperTradingManager.createAndFillPaperOrder(
        idea.symbol,
        idea.direction,
        idea.entry,
        idea.stopLoss,
        idea.takeProfit1,
        idea.takeProfit2,
        idea.confidence,
        `${idea.reason} | ${risk.reason} | ${consensus.reason} | ${economicRiskNote} | ${newsRiskNote} | ${portfolioRiskNote} | ${adaptiveConfidence.reason}`,
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
        newsIntelligence.marketRiskScore,
        portfolioIntelligence.summary.portfolioRiskScore
      ),
      reason:
        "AI paper trade executed with Adaptive Confidence Engine, strategy selection, economic risk layer, news intelligence layer, portfolio intelligence layer and stored in memory.",
      payload: {
        idea,
        risk,
        consensus,
        learning,
        strategyEvolution,
        economicCalendar,
        newsIntelligence,
        portfolioIntelligence,
        newsTradingAction,
        portfolioTradingAction,
        adaptiveConfidence,
        portfolioConfidencePenalty,
        portfolioAdjustedConfidence,
        economicMemory,
        newsMemory,
        portfolioMemory,
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
      portfolioIntelligence,
      newsTradingAction,
      portfolioTradingAction,
      adaptiveConfidence,
      portfolioConfidencePenalty,
      portfolioAdjustedConfidence,
      economicMemory,
      newsMemory,
      portfolioMemory,
      execution,
      memory,
      message:
        "AI paper trade executed successfully with Portfolio-aware Adaptive Confidence, economic risk and news risk integration.",
    };
  }
}
