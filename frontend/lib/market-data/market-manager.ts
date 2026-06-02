import { getMockMarketPrices, getMarketProviderStatus } from "./market-provider";
import { setMarketCache, getAllCachedMarkets, getMarketCacheStatus } from "./market-cache";
import { defaultMarketWatchlist } from "./market-watchlist";

export async function refreshMarketData() {
  const providerStatus = await getMarketProviderStatus();
  const prices = await getMockMarketPrices();

  prices.forEach((price) => setMarketCache(price));

  return {
    providerStatus,
    prices,
    cacheStatus: getMarketCacheStatus(),
    watchlist: defaultMarketWatchlist,
  };
}

export async function buildMarketResourceBundles() {
  await refreshMarketData();

  return getAllCachedMarkets().map((market) => ({
    market,
    technical: {
      symbol: market.symbol,
      trend:
        market.changePercent > 0
          ? "BULLISH"
          : market.changePercent < 0
            ? "BEARISH"
            : "NEUTRAL",
      strength: Math.min(100, Math.round(Math.abs(market.changePercent) * 20)),
      indicators: {
        rsi: 50,
        macd: market.changePercent >= 0 ? "BULLISH" : "BEARISH",
        movingAverage: market.changePercent >= 0 ? "ABOVE" : "BELOW",
      },
      source: "MOCK",
    },
    fundamental: {
      symbol: market.symbol,
      rating: "UNKNOWN",
      drivers: ["Fundamental source layer will be connected in a later version."],
      source: "MOCK",
      updatedAt: new Date().toISOString(),
    },
    news: [],
  }));
}

export function getForwardLearningDataPlan() {
  return {
    purpose:
      "Prepare market data, news, technical and fundamental resources for future AI forward testing and demo learning loops.",
    futureInputs: [
      "Broker prices",
      "TradingView technical signals",
      "Yahoo Finance fundamentals",
      "Capital.com analysis/news",
      "Economic calendar",
      "High-impact news",
      "Demo trade outcomes",
    ],
    futureOutputs: [
      "Market behavior memory",
      "Strategy performance ranking",
      "AI trade plan improvements",
      "Risk rule updates",
      "Forward testing reports",
    ],
  };
}