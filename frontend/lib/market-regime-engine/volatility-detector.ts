import type { VolatilityRegime } from "./regime-types";

export function detectVolatility(params: {
  price: number;
  spread: number;
  priceChangePercent: number;
}): {
  volatility: VolatilityRegime;
  volatilityScore: number;
} {
  const spreadPercent =
    params.price === 0
      ? 0
      : Math.abs((params.spread / params.price) * 100);

  const movementPower = Math.abs(params.priceChangePercent);
  const rawScore = Math.round(movementPower * 120 + spreadPercent * 45);

  if (rawScore >= 85) {
    return {
      volatility: "EXTREME_VOLATILITY",
      volatilityScore: Math.min(100, rawScore),
    };
  }

  if (rawScore >= 60) {
    return {
      volatility: "VOLATILE",
      volatilityScore: rawScore,
    };
  }

  if (rawScore >= 35) {
    return {
      volatility: "ELEVATED",
      volatilityScore: rawScore,
    };
  }

  if (rawScore <= 12) {
    return {
      volatility: "LOW_VOLATILITY",
      volatilityScore: rawScore,
    };
  }

  return {
    volatility: "NORMAL",
    volatilityScore: rawScore,
  };
}
