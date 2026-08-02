/**
 * Python Backend Client
 * Next.js → Python FastAPI Bridge
 * URL via env var: PYTHON_BACKEND_URL (z.B. https://destinate-python.railway.app)
 *
 * Alle Calls sind non-fatal — wenn Python Backend nicht erreichbar ist,
 * läuft das System normal weiter (TypeScript Trade Manager als Fallback).
 */

import { pythonBackendAuthHeader } from "./auth-header";

const BASE_URL = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";

// Diagnose (02.08.): exquisite-rejoicing bekommt seit Tagen alle ~2 Minuten
// POST /api/v1/lifecycle/balance mit 401, während divine-warmth denselben
// Aufruf im selben Takt mit 200 beantwortet. Die Quell-IPs (100.64.0.x) zeigen
// auf einen Dienst im eigenen Railway-Netz, und lifecycle/balance wird im
// ganzen Repo NUR von dieser Datei aufgerufen. Welche Ziel-URL dieses Modul
// tatsächlich auflöst, war von aussen nicht feststellbar — deshalb hier eine
// einmalige Ausgabe beim ersten Aufruf. Rein additiv, ändert kein Verhalten.
// Der Schlüssel selbst wird NIEMALS geloggt, nur ob er vorhanden ist.
let _diagLogged = false;
function logTargetOnce(): void {
  if (_diagLogged) return;
  _diagLogged = true;
  const usedNew = !!process.env.PYTHON_BACKEND_NEW_URL;
  console.log(
    `[py-client] Ziel=${BASE_URL || "(leer)"} | Quelle=${usedNew ? "PYTHON_BACKEND_NEW_URL" : "PYTHON_BACKEND_URL"} | Schlüssel vorhanden=${!!process.env.BACKEND_API_KEY}`
  );
}

function isConfigured(): boolean {
  logTargetOnce();
  return BASE_URL.length > 5;
}

async function post<T = unknown>(path: string, body: unknown): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    // Fehlschläge waren bisher völlig still (02.08.) — deshalb fiel niemandem
    // auf, dass ein Ziel dauerhaft mit 401 antwortet. Jetzt sichtbar, ohne das
    // fehlertolerante Verhalten zu ändern (Rückgabe bleibt null).
    if (!res.ok) {
      console.warn(`[py-client] ${res.status} bei POST ${path} -> ${BASE_URL}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (e) {
    console.warn(`[py-client] POST ${path} fehlgeschlagen -> ${BASE_URL}:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function get<T = unknown>(path: string): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: pythonBackendAuthHeader(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[py-client] ${res.status} bei GET ${path} -> ${BASE_URL}`);
      return null;
    }
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
