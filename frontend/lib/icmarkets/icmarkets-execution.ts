/**
 * IC Markets cTrader order execution
 * Mirrors capital-com-execution.ts but uses MCP tools.
 * Volume is sent in Units (cTrader setting = Units, not Lots).
 */

import { icPlaceOrder, isICMarketsConfigured } from "./icmarkets-client";
import { getICMarketsSession } from "./icmarkets-session";

// cTrader symbol mapping: our internal symbol → cTrader symbol name
const SYMBOL_MAP: Record<string, string> = {
  // Forex
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  USDCHF: "USDCHF",
  GBPJPY: "GBPJPY",
  EURJPY: "EURJPY",
  EURGBP: "EURGBP",
  NZDUSD: "NZDUSD",
  // Indices (cTrader names)
  US100:  "NAS100",
  US500:  "SPX500",
  GER40:  "GER40",
  UK100:  "UK100",
  // Commodities
  GOLD:   "XAUUSD",
  SILVER: "XAGUSD",
  OIL:    "USOIL",
};

// Pip values per symbol per 1 unit in account currency (CHF approx)
// Forex: 1 unit = 1 base currency unit, pip = 0.0001 price move
// Gold/Silver/Oil: 1 unit = 1 oz / 1 bbl, pip = 0.01 price move
const PIP_VALUE_PER_UNIT: Record<string, number> = {
  EURUSD: 0.000105,
  GBPUSD: 0.000105,
  USDJPY: 0.000095,
  AUDUSD: 0.000105,
  USDCAD: 0.000105,
  USDCHF: 0.0001,
  GBPJPY: 0.000095,
  EURJPY: 0.000095,
  EURGBP: 0.000105,
  NZDUSD: 0.000105,
  NAS100:  0.001,
  SPX500:  0.001,
  GER40:   0.001,
  UK100:   0.001,
  XAUUSD:  0.01,   // 1 pip = $0.01 per oz (2-decimal symbol)
  XAGUSD:  0.001,  // 1 pip = $0.001 per oz
  USOIL:   0.001,  // 1 pip = $0.001 per bbl
};

// Minimum units per symbol
const MIN_UNITS: Record<string, number> = {
  EURUSD: 1000, GBPUSD: 1000, USDJPY: 1000, AUDUSD: 1000,
  USDCAD: 1000, USDCHF: 1000, GBPJPY: 1000, EURJPY: 1000,
  EURGBP: 1000, NZDUSD: 1000,
  NAS100: 1, SPX500: 1, GER40: 1, UK100: 1,
  XAUUSD: 1, XAGUSD: 10, USOIL: 10,
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
