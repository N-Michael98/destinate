import { classifyRegime } from "./regime-classifier";

export class RegimeManager {
  getRegime(
    symbol: string,
    price: number,
    spread: number,
    previousPrice?: number | null
  ) {
    const result = classifyRegime(symbol, price, spread, previousPrice);

    const confidence = Math.max(
      45,
      Math.min(
        95,
        Math.round(
          55 +
            Math.abs(result.trendScore - 50) * 0.35 +
            result.volatilityScore * 0.18
        )
      )
    );

    return {
      symbol,
      price,
      previousPrice: previousPrice ?? null,
      spread,
      confidence,
      updatedAt: new Date().toISOString(),
      ...result,
      reason: `${symbol} classified as ${result.primaryRegime}. Trend=${result.trend}, trendScore=${result.trendScore}, volatility=${result.volatility}, volatilityScore=${result.volatilityScore}, risk=${result.risk}.`,
    };
  }
}

export const regimeManager = new RegimeManager();
