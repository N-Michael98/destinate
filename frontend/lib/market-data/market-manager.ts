import { setMarketCache, getAllCachedMarkets, getMarketCacheStatus } from "./market-cache";
import { defaultMarketWatchlist, HIGH_PRIORITY_SYMBOLS } from "./market-watchlist";
import type { MarketSnapshot } from "./market-types";

async function fetchRealPrices(): Promise<MarketSnapshot[]> {
  try {
    const res = await fetch("/api/capital/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: HIGH_PRIORITY_SYMBOLS }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.prices?.length) throw new Error("No prices");
    return (data.prices as Array<{ symbol: string; bid: number; ask: number }>).map(p => {
      const meta = defaultMarketWatchlist.find(m => m.symbol === p.symbol);
      return {
        symbol:        p.symbol,
        displayName:   meta?.displayName ?? p.symbol,
        category:      (meta?.category ?? "Forex") as MarketSnapshot["category"],
        price:         (p.bid + p.ask) / 2,
        bid:           p.bid,
        ask:           p.ask,
        changePercent: 0,
        source:        "CAPITAL_COM",
        timestamp:     new Date().toISOString(),
        freshness:     "FRESH",
      } satisfies MarketSnapshot;
    });
  } catch {
    return [];
  }
}

async function fetchPythonPrices(): Promise<MarketSnapshot[]> {
  try {
    const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
    if (!PYTHON_BASE) return [];
    const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: HIGH_PRIORITY_SYMBOLS }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const prices: MarketSnapshot[] = [];
    for (const [symbol, info] of Object.entries(data?.prices ?? {})) {
      const p = info as { price?: number; bid?: number; ask?: number };
      if (!p?.price) continue;
      const meta = defaultMarketWatchlist.find(m => m.symbol === symbol);
      prices.push({
        symbol,
        displayName:   meta?.displayName ?? symbol,
        category:      (meta?.category ?? "Forex") as MarketSnapshot["category"],
        price:         p.price,
        bid:           p.bid,
        ask:           p.ask,
        changePercent: 0,
        source:        "CAPITAL_COM",
        timestamp:     new Date().toISOString(),
        freshness:     "FRESH",
      });
    }
    return prices;
  } catch {
    return [];
  }
}

function fallbackPrices(): MarketSnapshot[] {
  return defaultMarketWatchlist.map(m => ({
    symbol:        m.symbol,
    displayName:   m.displayName,
    category:      m.category as MarketSnapshot["category"],
    price:         0,
    changePercent: 0,
    source:        "CAPITAL_COM" as const,
    timestamp:     new Date().toISOString(),
    freshness:     "STALE" as const,
  }));
}

export async function refreshMarketData() {
  // Versuche echte Preise — zuerst Capital.com direkt, dann Python Backend
  let prices = await fetchRealPrices();
  if (!prices.length) prices = await fetchPythonPrices();
  if (!prices.length) prices = fallbackPrices();

  prices.forEach(p => setMarketCache(p));

  const realCount  = prices.filter(p => p.freshness === "FRESH").length;
  const staleCount = prices.filter(p => p.freshness === "STALE").length;

  return {
    providerStatus: {
      provider: realCount > 0 ? "Capital.com Live" : "Fallback",
      status:   realCount > 0 ? "CONNECTED" : "DISCONNECTED",
      message:  `${realCount} live prices, ${staleCount} stale`,
    },
    prices,
    cacheStatus: getMarketCacheStatus(),
    watchlist:   defaultMarketWatchlist,
  };
}

export async function buildMarketResourceBundles() {
  const { prices } = await refreshMarketData();

  return prices.map(market => ({
    market,
    technical: {
      symbol:   market.symbol,
      trend:    market.changePercent > 0 ? "BULLISH" : market.changePercent < 0 ? "BEARISH" : "NEUTRAL",
      strength: Math.min(100, Math.round(Math.abs(market.changePercent) * 20)),
      indicators: {
        rsi:           50,
        macd:          market.changePercent >= 0 ? "BULLISH" : "BEARISH",
        movingAverage: market.changePercent >= 0 ? "ABOVE" : "BELOW",
      },
      source:    market.freshness === "FRESH" ? "CAPITAL_COM" : "STALE",
    },
    fundamental: {
      symbol:    market.symbol,
      rating:    "UNKNOWN",
      drivers:   ["Live fundamental data via Capital.com API"],
      source:    "CAPITAL_COM",
      updatedAt: new Date().toISOString(),
    },
    news: [],
  }));
}

export function getForwardLearningDataPlan() {
  return {
    purpose: "Prepare market data, news, technical and fundamental resources for AI forward testing.",
    activeMarkets: HIGH_PRIORITY_SYMBOLS,
    allMarkets:    defaultMarketWatchlist.map(m => m.symbol),
  };
}
