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

// Dollar value per 1-price-unit move per MCP unit.
// Formula: riskAmount = units × priceDistance × PRICE_VALUE
// Verified: XAUUSD = 0.01 (400 MCP × 0.01 × 50 = $200 ✓)
//           EURUSD = 0.01 (10M MCP × 0.01 × 0.002 = $200 ✓)
// JPY pairs: lower because pip value is in JPY (~145 conversion)
const PRICE_VALUE: Record<string, number> = {
  // USD-quoted forex
  EURUSD: 0.01, GBPUSD: 0.01, AUDUSD: 0.01, NZDUSD: 0.01,
  // USD-base forex (quote in CHF/CAD — approx USD conversion)
  USDCHF: 0.011, USDCAD: 0.0075,
  // JPY-quoted (divide by ~145 for USD)
  USDJPY: 0.000069, EURJPY: 0.000069, GBPJPY: 0.000069,
  // GBP-quoted
  EURGBP: 0.013,
  // Metals priced in USD
  XAUUSD: 0.01, XAGUSD: 0.01,
  // Indices ($1 per point per display contract)
  USTEC: 0.01, US500: 0.01, UK100: 0.01, DE40: 0.01,
  // Oil (~$0.01 per barrel per display unit)
  WTI: 0.01, BRENT: 0.01,
};

// Minimum MCP units per instrument (cTrader minimum)
const MIN_UNITS: Record<string, number> = {
  // Forex: min 0.01 lot = 1,000 units display = 100,000 MCP
  EURUSD: 100000, GBPUSD: 100000, USDJPY: 100000, AUDUSD: 100000,
  USDCAD: 100000, USDCHF: 100000, GBPJPY: 100000, EURJPY: 100000,
  EURGBP: 100000, NZDUSD: 100000,
  // Indices: min 1 contract
  USTEC: 100, US500: 100, UK100: 100, DE40: 100,
  // Commodities: min ~1oz/barrel
  XAUUSD: 100, XAGUSD: 100, WTI: 100, BRENT: 100,
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
