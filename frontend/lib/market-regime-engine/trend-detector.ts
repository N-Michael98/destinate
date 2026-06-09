import type { TrendRegime } from "./regime-types";

export function detectTrend(params: {
  price: number;
  previousPrice?: number | null;
  symbol: string;
}): {
  trend: TrendRegime;
  trendScore: number;
  priceChange: number;
  priceChangePercent: number;
} {
  const previousPrice = params.previousPrice ?? params.price;
  const priceChange = Number((params.price - previousPrice).toFixed(5));
  const priceChangePercent =
    previousPrice === 0
      ? 0
      : Number(((priceChange / previousPrice) * 100).toFixed(4));

  const absMove = Math.abs(priceChangePercent);

  let trend: TrendRegime = "RANGING";
  let trendScore = 50;

  if (priceChangePercent >= 0.35) {
    trend = "STRONG_BULL";
    trendScore = 88;
  } else if (priceChangePercent >= 0.12) {
    trend = "TRENDING_BULL";
    trendScore = 75;
  } else if (priceChangePercent > 0.03) {
    trend = "WEAK_BULL";
    trendScore = 60;
  } else if (priceChangePercent <= -0.35) {
    trend = "STRONG_BEAR";
    trendScore = 12;
  } else if (priceChangePercent <= -0.12) {
    trend = "TRENDING_BEAR";
    trendScore = 25;
  } else if (priceChangePercent < -0.03) {
    trend = "WEAK_BEAR";
    trendScore = 40;
  }

  if (absMove < 0.03) {
    trend = "RANGING";
    trendScore = 50;
  }

  return {
    trend,
    trendScore,
    priceChange,
    priceChangePercent,
  };
}
