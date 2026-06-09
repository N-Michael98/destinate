import { detectTrend } from "./trend-detector";
import { detectVolatility } from "./volatility-detector";
import { detectRiskRegime } from "./risk-regime-detector";
import type { PrimaryMarketRegime } from "./regime-types";

function resolvePrimaryRegime(params: {
  trendScore: number;
  volatilityScore: number;
  priceChangePercent: number;
}): PrimaryMarketRegime {
  if (params.volatilityScore >= 75) return "HIGH_VOLATILITY";
  if (params.volatilityScore <= 12) return "LOW_VOLATILITY";

  if (params.trendScore >= 70 && params.priceChangePercent > 0) {
    return "BULLISH_TREND";
  }

  if (params.trendScore <= 30 && params.priceChangePercent < 0) {
    return "BEARISH_TREND";
  }

  if (Math.abs(params.priceChangePercent) >= 0.25) {
    return "BREAKOUT";
  }

  if (
    params.trendScore > 40 &&
    params.trendScore < 60 &&
    params.volatilityScore >= 45
  ) {
    return "REVERSAL_RISK";
  }

  return "RANGING";
}

function resolvePreferredStrategyBias(regime: PrimaryMarketRegime) {
  const map: Record<PrimaryMarketRegime, string> = {
    BULLISH_TREND: "Trend Pullback / Momentum Long",
    BEARISH_TREND: "Bearish Continuation / Defensive Short",
    RANGING: "Mean Reversion / Support Resistance",
    BREAKOUT: "Breakout / Liquidity Sweep",
    REVERSAL_RISK: "Reversal Confirmation / Reduced Size",
    HIGH_VOLATILITY: "Volatility Expansion / Strict Risk",
    LOW_VOLATILITY: "Compression Breakout / Wait For Expansion",
  };

  return map[regime];
}

export function classifyRegime(
  symbol: string,
  price: number,
  spread: number,
  previousPrice?: number | null
) {
  const trend = detectTrend({
    symbol,
    price,
    previousPrice,
  });

  const volatility = detectVolatility({
    price,
    spread,
    priceChangePercent: trend.priceChangePercent,
  });

  const risk = detectRiskRegime({
    symbol,
    trendScore: trend.trendScore,
    volatilityScore: volatility.volatilityScore,
  });

  const primaryRegime = resolvePrimaryRegime({
    trendScore: trend.trendScore,
    volatilityScore: volatility.volatilityScore,
    priceChangePercent: trend.priceChangePercent,
  });

  return {
    ...trend,
    ...volatility,
    ...risk,
    primaryRegime,
    preferredStrategyBias: resolvePreferredStrategyBias(primaryRegime),
  };
}
