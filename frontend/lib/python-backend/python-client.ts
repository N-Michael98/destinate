/**
 * Python Backend Client
 * Next.js → Python FastAPI Bridge
 * URL via env var: PYTHON_BACKEND_URL (z.B. https://destinate-python.railway.app)
 *
 * Alle Calls sind non-fatal — wenn Python Backend nicht erreichbar ist,
 * läuft das System normal weiter (TypeScript Trade Manager als Fallback).
 */

const BASE_URL = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";

function isConfigured(): boolean {
  return BASE_URL.length > 5;
}

async function post<T = unknown>(path: string, body: unknown): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function get<T = unknown>(path: string): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Lifecycle: Trade registrieren ─────────────────────────────────────────────

export async function pyRegisterTrade(params: {
  tradeId:     string;
  symbol:      string;
  direction:   "BUY" | "SELL";
  entry:       number;
  stopLoss:    number;
  takeProfit:  number;
  size:        number;
  confidence:  number;
  tradingStyle: string;
  broker:      string;
  openedAt?:   string;
}): Promise<boolean> {
  const res = await post("/api/v1/lifecycle/register", {
    trade_id:      params.tradeId,
    symbol:        params.symbol,
    direction:     params.direction,
    entry:         params.entry,
    stop_loss:     params.stopLoss,
    take_profit:   params.takeProfit,
    size:          params.size,
    confidence:    params.confidence,
    trading_style: params.tradingStyle,
    broker:        params.broker,
    opened_at:     params.openedAt,
  });
  return !!res;
}

// ── Lifecycle: Preis-Update + Aktion holen ────────────────────────────────────

export type LifecycleAction =
  | { action: "UPDATE_SL"; new_sl: number }
  | { action: "CLOSE"; reason: string }
  | { action: "PARTIAL_CLOSE"; volume: number }
  | { action: null; progress?: number };

export async function pyPriceUpdate(tradeId: string, currentPrice: number): Promise<LifecycleAction> {
  const res = await post<{ action: LifecycleAction }>("/api/v1/lifecycle/price-update", {
    trade_id:      tradeId,
    current_price: currentPrice,
  });
  return (res as { action?: LifecycleAction })?.action ?? { action: null };
}

// ── Lifecycle: Trade schliessen ───────────────────────────────────────────────

export async function pyCloseTrade(tradeId: string, pnl: number, reason: string): Promise<void> {
  await post("/api/v1/lifecycle/close", { trade_id: tradeId, pnl, reason });
}

// ── Lifecycle: Balance Update ─────────────────────────────────────────────────

export async function pyUpdateBalance(balance: number): Promise<void> {
  await post("/api/v1/lifecycle/balance", { balance });
}

// ── Intelligence: Markt analysieren ──────────────────────────────────────────

export interface PyIntelligenceResult {
  symbol:             string;
  signal:             "BUY" | "SELL" | "NEUTRAL";
  score:              number;
  confidence:         number;
  trade_recommended:  boolean;
  layers: {
    technical:        { signal: string; score: number; rsi?: number; adx?: number };
    regime:           { regime: string; trade_ok: boolean };
    multi_timeframe:  { alignment: string; alignment_score: number };
    correlation:      { confirmed: boolean; boost: number };
  };
}

export async function pyAnalyzeSymbol(symbol: string): Promise<PyIntelligenceResult | null> {
  return get<PyIntelligenceResult>(`/api/v1/intelligence/analyze/${symbol}`);
}

export async function pyAnalyzeMulti(symbols: string[]): Promise<PyIntelligenceResult[]> {
  const res = await post<{ results: PyIntelligenceResult[] }>(
    "/api/v1/intelligence/analyze/multi",
    { symbols }
  );
  return res?.results ?? [];
}

// ── Event Bus: Status ─────────────────────────────────────────────────────────

export async function pyGetEventStats(): Promise<unknown> {
  return get("/api/v1/events/stats");
}

// ── Health Check ──────────────────────────────────────────────────────────────

export async function pyHealthCheck(): Promise<boolean> {
  const res = await get<{ ok: boolean }>("/health");
  return !!(res as { ok?: boolean })?.ok;
}

export { isConfigured as isPythonBackendConfigured };
