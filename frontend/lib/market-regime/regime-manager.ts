import { analyzeNewsRegime } from "./news-regime";
import { analyzeRiskRegime } from "./risk-regime";
import type {
  RegimeAnalysis,
  RegimeResult,
} from "./regime-types";
import { analyzeTrendRegime } from "./trend-regime";
import { analyzeVolatilityRegime } from "./volatility-regime";

export function getMarketRegimeStatus() {
  return {
    status: "READY",
    strategyFiltering: true,
    liveTradingEnabled: false,
  };
}

export function getMarketRegimeAnalyses(
  market: string
): RegimeAnalysis[] {
  return [
    analyzeTrendRegime(market),
    analyzeVolatilityRegime(market),
    analyzeRiskRegime(market),
    analyzeNewsRegime(market),
  ];
}

export function determineMarketRegime(
  market: string
): RegimeResult {
  const analyses = getMarketRegimeAnalyses(market);

  const strongest = analyses.sort(
    (a, b) => b.confidence - a.confidence
  )[0];

  const strategyMap: Record<string, string> = {
    TRENDING: "Momentum Breakout",
    RANGING: "Mean Reversion",
    VOLATILE: "Volatility Expansion",
    LOW_VOLATILITY: "Compression Breakout",
    RISK_ON: "Growth Momentum",
    RISK_OFF: "Safe Haven Flow",
    NEWS_DRIVEN: "Event Reaction",
  };

  return {
    primaryRegime: strongest.regime,
    confidence: strongest.confidence,
    preferredStrategy:
      strategyMap[strongest.regime] ??
      "Market Observation",
  };
}

export function getRegimeRoadmap() {
  return {
    currentPhase: "Market Regime Engine",

    nextSteps: [
      "Portfolio Intelligence",
      "AI Trading Brain",
      "OpenAI Integration",
      "Claude Integration",
      "TradingView Integration",
    ],
  };
}