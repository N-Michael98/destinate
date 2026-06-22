/**
 * IC Markets cTrader order execution
 * Volume formula: MCP_units = riskAmount / (priceDistance × PRICE_VALUE[symbol])
 * Verified: XAUUSD 400 MCP × 0.01 × $50 stop = $200 risk ✓
 *           EURUSD 10M MCP × 0.01 × 0.002 stop = $200 risk ✓
 */

import { icPlaceOrder, isICMarketsConfigured, icGetPrice } from "./icmarkets-client";
import { getICMarketsSession } from "./icmarkets-session";

// cTrader symbol mapping: our internal symbol → exact cTrader symbolName
// Verified via /api/icmarkets/symbols endpoint (351 symbols)
const SYMBOL_MAP: Record<string, string> = {
  // Forex (all confirmed ✅)
  EURUSD: "EURUSD",   // symbolId: 1
  GBPUSD: "GBPUSD",   // symbolId: 2
  EURJPY: "EURJPY",   // symbolId: 3
  USDJPY: "USDJPY",   // symbolId: 4
  AUDUSD: "AUDUSD",   // symbolId: 5
  USDCHF: "USDCHF",   // symbolId: 6
  GBPJPY: "GBPJPY",   // symbolId: 7
  USDCAD: "USDCAD",   // symbolId: 8
  EURGBP: "EURGBP",   // symbolId: 9
  NZDUSD: "NZDUSD",   // symbolId: 12
  // Indices (all confirmed ✅)
  US500:  "US500",    // symbolId: 10013
  SPX500: "US500",
  UK100:  "UK100",    // symbolId: 10011
  US100:  "USTEC",    // symbolId: 10014
  NAS100: "USTEC",
  GER40:  "DE40",     // symbolId: 10046
  // Commodities (all confirmed ✅)
  XAUUSD: "XAUUSD",   // symbolId: 41
  GOLD:   "XAUUSD",
  XAGUSD: "XAGUSD",   // symbolId: 42
  SILVER: "XAGUSD",
  USOIL:  "WTI",      // symbolId: 10022
  OIL:    "WTI",
  BRENT:  "BRENT",    // symbolId: 10021
};

// cTrader is set to UNITS mode — volume parameter = actual units (1:1, no ×100 factor)
//
// PRICE_VALUE = $ per 1-price-unit move per 1 unit of instrument
// Formula: riskAmount = units × stopDistance × PRICE_VALUE
//
// USD-quoted (EURUSD, GBPUSD, XAUUSD, indices): PRICE_VALUE = 1.0
//   e.g. EURUSD: 100,000 units × 0.002 stop × 1.0 = $200 risk ✓
//   e.g. XAUUSD: 13 units × $15 stop × 1.0 = $195 risk ✓
// JPY-quoted: PRICE_VALUE = 1/rate (rate ≈ 145-155)
// USD-base/other-quote: PRICE_VALUE < 1 (CAD, CHF ≈ 0.73-0.91)
const PRICE_VALUE: Record<string, number> = {
  // USD-quoted forex (1 unit = 1 base currency ≈ $1, move in USD)
  EURUSD: 1.0, GBPUSD: 1.0, AUDUSD: 1.0, NZDUSD: 1.0,
  // USD-base / non-USD-quote
  USDCHF: 1.1,   // CHF quote → ÷0.90 ≈ 1.11
  USDCAD: 0.73,  // CAD quote → ÷1.37 ≈ 0.73
  EURGBP: 1.27,  // GBP quote → ×1.27
  // JPY-quoted (÷ ~150)
  USDJPY: 0.0067, EURJPY: 0.0067, GBPJPY: 0.0067,
  // Metals (1 unit = 1 oz/unit, price in USD)
  XAUUSD: 1.0, XAGUSD: 1.0,
  // Indices (1 unit = 1 contract = $1/point)
  USTEC: 1.0, US500: 1.0, UK100: 1.0, DE40: 1.0,
  // Oil (1 unit = 1 barrel ≈ $1/move)
  WTI: 1.0, BRENT: 1.0,
};

// Minimum units per instrument in Units mode (cTrader min)
const MIN_UNITS: Record<string, number> = {
  // Forex: min 0.01 lot = 1,000 units
  EURUSD: 1000, GBPUSD: 1000, USDJPY: 1000, AUDUSD: 1000,
  USDCAD: 1000, USDCHF: 1000, GBPJPY: 1000, EURJPY: 1000,
  EURGBP: 1000, NZDUSD: 1000,
  // Indices: min 1 contract
  USTEC: 1, US500: 1, UK100: 1, DE40: 1,
  // Commodities: min 1 unit
  XAUUSD: 1, XAGUSD: 1, WTI: 1, BRENT: 1,
};

// Default stop distance (price units) when no SL price available
const DEFAULT_STOP: Record<string, number> = {
  EURUSD: 0.002, GBPUSD: 0.002, AUDUSD: 0.002, NZDUSD: 0.002,
  USDCHF: 0.002, USDCAD: 0.002, EURGBP: 0.002,
  USDJPY: 0.30, EURJPY: 0.30, GBPJPY: 0.30,
  XAUUSD: 15, XAGUSD: 0.3,
  USTEC: 100, US500: 20, UK100: 30, DE40: 40,
  WTI: 1.0, BRENT: 1.0,
};

function calcICPositionSize(
  ctraderSymbol: string,
  accountBalance: number,
  riskPercent: number,
  stopDistance: number, // actual price distance (|entry - SL|)
): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  const priceVal = PRICE_VALUE[ctraderSymbol] ?? 0.01;
  const stop = stopDistance > 0 ? stopDistance : (DEFAULT_STOP[ctraderSymbol] ?? 0.002);
  const units = Math.floor(riskAmount / (stop * priceVal));
  const minUnits = MIN_UNITS[ctraderSymbol] ?? 100000;
  return Math.max(units, minUnits);
}

export interface ICExecutionResult {
  ok: boolean;
  broker: "IC_MARKETS";
  positionId?: string;
  symbol: string;
  ctraderSymbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  stopDistance?: number;
  error?: string;
  executedAt: string;
}

export async function executeICMarketsOrder(req: {
  symbol: string;
  direction: "BUY" | "SELL";
  riskPercent: number;
  accountBalance: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  confidence: number;
  tradingStyle: string;
}): Promise<ICExecutionResult> {
  const ts = new Date().toISOString();

  if (!isICMarketsConfigured()) {
    return { ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol: "", direction: req.direction, volume: 0, error: "IC Markets not configured", executedAt: ts };
  }

  const session = getICMarketsSession();
  if (!session) {
    return { ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol: "", direction: req.direction, volume: 0, error: "IC Markets not connected", executedAt: ts };
  }

  const ctraderSymbol = SYMBOL_MAP[req.symbol] ?? req.symbol;
  // Always use live balance from session (updated by keep-alive every 2min)
  const balance = session.balance > 0 ? session.balance : req.accountBalance;

  // ── Get live price to calculate actual stop distance ───────────────────────
  let stopDistance = DEFAULT_STOP[ctraderSymbol] ?? 0.002;
  try {
    const priceResult = await icGetPrice(ctraderSymbol);
    if (priceResult.ok && req.stopLossPrice && req.stopLossPrice > 0) {
      const currentPrice = req.direction === "BUY"
        ? (priceResult.ask ?? 0)
        : (priceResult.bid ?? 0);
      if (currentPrice > 0) {
        const actualStop = Math.abs(currentPrice - req.stopLossPrice);
        if (actualStop > 0) stopDistance = actualStop;
      }
    }
  } catch { /* use default */ }

  const volume = calcICPositionSize(ctraderSymbol, balance, req.riskPercent, stopDistance);

  console.log(`[IC Markets] ${req.symbol}→${ctraderSymbol} ${req.direction} vol=${volume} balance=${balance} risk=${req.riskPercent}% stop=${stopDistance.toFixed(5)}`);

  const result = await icPlaceOrder(
    ctraderSymbol,
    req.direction,
    volume,
    req.stopLossPrice,
    req.takeProfitPrice,
  );

  if (!result.ok) {
    console.error(`[IC Markets] ❌ ${ctraderSymbol} failed: ${result.error}`);
  } else if (!result.positionId) {
    console.warn(`[IC Markets] ⚠️ ${ctraderSymbol} ${req.direction} — positionId empty`);
  } else {
    console.log(`[IC Markets] ✅ ${ctraderSymbol} ${req.direction} positionId=${result.positionId} vol=${volume}`);
  }

  return {
    ok: result.ok,
    broker: "IC_MARKETS",
    positionId: result.positionId,
    symbol: req.symbol,
    ctraderSymbol,
    direction: req.direction,
    volume,
    stopDistance,
    error: result.error,
    executedAt: ts,
  };
}
