import { marketDataManager } from "@/lib/market-data-engine";
import { regimeManager } from "@/lib/market-regime-engine";
import { GPTAnalystManager } from "@/lib/gpt-analyst-engine/gpt-analyst-manager";
import { ClaudeRiskManager } from "@/lib/claude-risk-engine/claude-risk-manager";

import {
  RegimeAISyncItem,
  RegimeAISyncReport,
} from "./regime-ai-sync-types";

const VERSION = "V16.0.7.C" as const;

function resolveFinalAiBias(params: {
  gptBias: string;
  claudeApproved: boolean;
  volatilityScore: number;
  riskScore: number;
}): RegimeAISyncItem["finalAiBias"] {
  if (!params.claudeApproved) return "WAIT";

  if (params.volatilityScore >= 70 || params.riskScore >= 75) {
    return "RISK_REDUCED";
  }

  if (params.gptBias === "BULLISH") return "LONG_BIAS";
  if (params.gptBias === "BEARISH") return "SHORT_BIAS";

  return "WAIT";
}

function buildRecommendation(item: {
  symbol: string;
  primaryRegime: string;
  preferredStrategyBias: string;
  finalAiBias: RegimeAISyncItem["finalAiBias"];
}) {
  if (item.finalAiBias === "LONG_BIAS") {
    return `${item.symbol}: GPT/Claude regime sync supports long-biased strategy filtering using ${item.preferredStrategyBias}.`;
  }

  if (item.finalAiBias === "SHORT_BIAS") {
    return `${item.symbol}: GPT/Claude regime sync supports short-biased strategy filtering using ${item.preferredStrategyBias}.`;
  }

  if (item.finalAiBias === "RISK_REDUCED") {
    return `${item.symbol}: AI allows regime interpretation, but Claude risk requires reduced size under ${item.primaryRegime}.`;
  }

  return `${item.symbol}: AI regime sync recommends waiting for stronger confirmation.`;
}

export function buildRegimeAISyncReport(): RegimeAISyncReport {
  const gpt = new GPTAnalystManager();
  const claude = new ClaudeRiskManager();

  const prices = marketDataManager.refreshPrices();

  const items: RegimeAISyncItem[] = prices.map((price) => {
    const midpoint = Number(((price.bid + price.ask) / 2).toFixed(5));
    const previousMidpoint =
      price.previousBid !== undefined && price.previousAsk !== undefined
        ? Number(((price.previousBid + price.previousAsk) / 2).toFixed(5))
        : null;

    const regime = regimeManager.getRegime(
      price.symbol,
      midpoint,
      price.spread,
      previousMidpoint
    );

    const gptIdea = gpt.createTradeIdea(
      price.symbol,
      midpoint,
      regime.trend,
      regime.volatility,
      regime.risk
    );

    const claudeRisk = claude.assess(
      price.symbol,
      0,
      0,
      regime.volatilityScore >= 70 ? 0.5 : 1,
      regime.volatility
    );

    const finalAiBias = resolveFinalAiBias({
      gptBias: gptIdea.bias,
      claudeApproved: claudeRisk.approved,
      volatilityScore: regime.volatilityScore,
      riskScore: regime.riskScore,
    });

    const item: RegimeAISyncItem = {
      symbol: price.symbol,
      price: midpoint,
      primaryRegime: regime.primaryRegime,
      trend: regime.trend,
      trendScore: regime.trendScore,
      volatility: regime.volatility,
      volatilityScore: regime.volatilityScore,
      risk: regime.risk,
      riskScore: regime.riskScore,
      confidence: regime.confidence,
      preferredStrategyBias: regime.preferredStrategyBias,
      gptBias: gptIdea.bias,
      gptConfidence: gptIdea.confidence,
      gptReasoning: gptIdea.reasoning,
      claudeApproved: claudeRisk.approved,
      claudeRisk: claudeRisk.overallRisk,
      claudeConfidence: claudeRisk.confidence,
      claudeReasoning: claudeRisk.reasoning,
      finalAiBias,
      recommendation: "",
    };

    return {
      ...item,
      recommendation: buildRecommendation(item),
    };
  });

  const longBiasMarkets = items.filter(
    (item) => item.finalAiBias === "LONG_BIAS"
  ).length;

  const shortBiasMarkets = items.filter(
    (item) => item.finalAiBias === "SHORT_BIAS"
  ).length;

  const waitMarkets = items.filter(
    (item) => item.finalAiBias === "WAIT"
  ).length;

  const riskReducedMarkets = items.filter(
    (item) => item.finalAiBias === "RISK_REDUCED"
  ).length;

  const topAiOpportunity =
    items.length === 0
      ? null
      : [...items].sort(
          (a, b) =>
            b.confidence +
            b.trendScore -
            (b.volatilityScore * 0.25) -
            (a.confidence + a.trendScore - a.volatilityScore * 0.25)
        )[0];

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalMarkets: items.length,
    longBiasMarkets,
    shortBiasMarkets,
    waitMarkets,
    riskReducedMarkets,
    topAiOpportunity,
    items,
    summary:
      "Regime AI Sync connects real market regime classification with GPT Analyst bias and Claude Risk approval in simulation mode.",
    updatedAt: new Date().toISOString(),
  };
}
