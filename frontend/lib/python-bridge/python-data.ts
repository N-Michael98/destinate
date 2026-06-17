/**
 * Shared Python backend data fetcher.
 * Used by GPT, Claude, Consensus, Strategy Evolution and Forward Testing.
 */

const PYTHON_BASE = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

export type PyPrice = {
  symbol: string;
  price: number | null;
  currency: string;
};

export type PyIndicators = {
  symbol: string;
  price: number | null;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  indicators: {
    rsi:        { value: number | null; signal: string };
    macd:       { macd: number | null; signal: number | null; hist: number | null };
    ema:        { ema20: number | null; ema50: number | null; ema200: number | null };
    bollinger:  { upper: number | null; lower: number | null; width: number | null };
    adx:        { adx: number | null };
    atr:        number | null;
  };
  candles_used: number;
};

export type PyBacktestResult = {
  symbol: string;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
};

// ── Prices ──────────────────────────────────────────────────────────────────

export async function fetchPrices(symbols: string[]): Promise<PyPrice[]> {
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const d = await res.json();
    return d.prices ?? [];
  } catch {
    return symbols.map((s) => ({ symbol: s, price: null, currency: "USD" }));
  }
}

export async function fetchPrice(symbol: string): Promise<number | null> {
  const results = await fetchPrices([symbol]);
  return results[0]?.price ?? null;
}

// ── Indicators ───────────────────────────────────────────────────────────────

export async function fetchIndicators(
  symbol: string,
  interval = "1h",
  period = "1mo"
): Promise<PyIndicators | null> {
  try {
    const res = await fetch(
      `${PYTHON_BASE}/api/v1/indicators/${symbol}?interval=${interval}&period=${period}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    return await res.json() as PyIndicators;
  } catch {
    return null;
  }
}

export async function fetchIndicatorsMany(
  symbols: string[],
  interval = "1h",
  period = "1mo"
): Promise<PyIndicators[]> {
  const results = await Promise.all(
    symbols.map((s) => fetchIndicators(s, interval, period))
  );
  return results.filter((r): r is PyIndicators => r !== null);
}

// ── Backtest ─────────────────────────────────────────────────────────────────

export async function fetchBacktest(
  symbol: string,
  interval = "1h",
  period = "6mo"
): Promise<PyBacktestResult | null> {
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, interval, period, initial_balance: 10000 }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json() as PyBacktestResult;
  } catch {
    return null;
  }
}

// ── Indicator summary als Text für AI-Prompts ────────────────────────────────

export function formatIndicatorsForPrompt(ind: PyIndicators): string {
  const i = ind.indicators;
  return [
    `Symbol: ${ind.symbol}`,
    `Current Price: ${ind.price ?? "N/A"}`,
    `Trend: ${ind.trend}`,
    `RSI(14): ${i.rsi.value?.toFixed(1) ?? "N/A"} [${i.rsi.signal}]`,
    `MACD Histogram: ${i.macd.hist?.toFixed(5) ?? "N/A"}`,
    `EMA20: ${i.ema.ema20 ?? "N/A"} | EMA50: ${i.ema.ema50 ?? "N/A"} | EMA200: ${i.ema.ema200 ?? "N/A"}`,
    `Bollinger: Upper ${i.bollinger.upper ?? "N/A"} / Lower ${i.bollinger.lower ?? "N/A"}`,
    `ATR(14): ${i.atr?.toFixed(5) ?? "N/A"}`,
    `ADX: ${i.adx.adx?.toFixed(1) ?? "N/A"}`,
  ].join("\n");
}

// ── Backtest summary als Text ────────────────────────────────────────────────

export function formatBacktestForPrompt(b: PyBacktestResult): string {
  return [
    `Backtest (${b.symbol} 6mo): ${b.total_trades} trades`,
    `Win-Rate: ${b.win_rate}% | Profit-Factor: ${b.profit_factor}`,
    `Total Return: ${b.total_return_pct}% | Max Drawdown: ${b.max_drawdown_pct}%`,
  ].join("\n");
}
