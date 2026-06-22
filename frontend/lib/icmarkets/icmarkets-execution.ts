/**
 * IC Markets cTrader order execution
 * Mirrors capital-com-execution.ts but uses MCP tools.
 * Volume is sent in Units (cTrader setting = Units, not Lots).
 */

import { icPlaceOrder, isICMarketsConfigured } from "./icmarkets-client";
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
  // Indices (confirmed ✅)
  US500:  "US500",    // symbolId: 10013 (was SPX500 — wrong)
  UK100:  "UK100",    // symbolId: 10011
  // Indices (cTrader name unknown — need to verify)
  US100:  "US100",    // try "US100" (might be NAS100, USTEC, etc.)
  NAS100: "US100",    // alias
  SPX500: "US500",    // alias → US500
  GER40:  "GER40",    // might be DE40, FDAX — to be confirmed
  // Commodities (confirmed ✅)
  XAUUSD: "XAUUSD",   // symbolId: 41
  GOLD:   "XAUUSD",   // alias
  XAGUSD: "XAGUSD",   // symbolId: 42
  SILVER: "XAGUSD",   // alias
  // Commodities (cTrader name unknown — BRENT seen in cache)
  USOIL:  "BRENT",    // IC Markets uses BRENT for crude oil
  OIL:    "BRENT",    // alias
};

// cTrader MCP volume: internally divides input by 100 for display.
// Forex min display = 10,000 → min MCP units = 1,000,000
// XAUUSD: 400 MCP → 4oz → min ~100 MCP
// Pip values calibrated so: 1% risk (200 CHF) / 20 pip stop ≈ min trade size
const PIP_VALUE_PER_UNIT: Record<string, number> = {
  EURUSD: 0.0000105,
  GBPUSD: 0.0000105,
  USDJPY: 0.0000095,
  AUDUSD: 0.0000105,
  USDCAD: 0.0000105,
  USDCHF: 0.000010,
  GBPJPY: 0.0000095,
  EURJPY: 0.0000095,
  EURGBP: 0.0000105,
  NZDUSD: 0.0000105,
  NAS100:  0.001,
  SPX500:  0.001,
  GER40:   0.001,
  UK100:   0.001,
  XAUUSD:  0.01,
  XAGUSD:  0.001,
  USOIL:   0.001,
};

// Minimum units per symbol (cTrader MCP minimum)
const MIN_UNITS: Record<string, number> = {
  EURUSD: 1000000, GBPUSD: 1000000, USDJPY: 1000000, AUDUSD: 1000000,
  USDCAD: 1000000, USDCHF: 1000000, GBPJPY: 1000000, EURJPY: 1000000,
  EURGBP: 1000000, NZDUSD: 1000000,
  NAS100: 10, SPX500: 10, GER40: 10, UK100: 10,
  XAUUSD: 100, XAGUSD: 100, USOIL: 100,
};

function calcICPositionSize(
  ctraderSymbol: string,
  accountBalance: number,
  riskPercent: number,
  stopPoints: number,
): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  const pipVal = PIP_VALUE_PER_UNIT[ctraderSymbol] ?? 0.0001;
  const stop = stopPoints > 0 ? stopPoints : 20;
  const units = Math.floor(riskAmount / (stop * pipVal));
  const minUnits = MIN_UNITS[ctraderSymbol] ?? 1000;
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
  const balance = session.balance > 0 ? session.balance : req.accountBalance;

  // Calculate stop distance in pips from the stop loss price
  // For forex: stopLossPrice is absolute price, entry ~= stopLoss ± few pips
  // For indices/metals: distance can be larger
  let stopPoints = 20;
  if (req.stopLossPrice && req.stopLossPrice > 0) {
    // Estimate entry ≈ stopLoss + typical distance
    // Use a safe default based on symbol type if we can't get exact entry
    const isMetalOrIndex = ["XAUUSD", "XAGUSD", "USOIL", "NAS100", "SPX500", "GER40", "UK100"].includes(ctraderSymbol);
    if (isMetalOrIndex) {
      // For gold around 4170: stop at 4164 → distance = 6 * 100 = 600 pips (0.01 per pip)
      // We use 50 pips as safe default to avoid giant positions
      stopPoints = 50;
    } else {
      stopPoints = 20; // 20 pips for forex
    }
  }

  const volume = calcICPositionSize(ctraderSymbol, balance, req.riskPercent, stopPoints);

  console.log(`[IC Markets] Executing ${req.symbol}→${ctraderSymbol} ${req.direction} vol=${volume} balance=${balance} risk=${req.riskPercent}%`);

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
    console.warn(`[IC Markets] ⚠️ ${ctraderSymbol} ${req.direction} — order sent but positionId empty (cTrader may have rejected silently)`);
  } else {
    console.log(`[IC Markets] ✅ ${ctraderSymbol} ${req.direction} — positionId: ${result.positionId}`);
  }

  return {
    ok: result.ok,
    broker: "IC_MARKETS",
    positionId: result.positionId,
    symbol: req.symbol,
    ctraderSymbol,
    direction: req.direction,
    volume,
    error: result.error,
    executedAt: ts,
  };
}
