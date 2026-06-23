/**
 * TypeScript Technical Indicators — technicalindicators package
 * Verwendet wenn Python Backend nicht erreichbar ist (Fallback)
 */

import {
  RSI, MACD, BollingerBands, ATR, EMA, SMA, ADX,
} from "technicalindicators";

export interface OHLCVBar {
  open: number; high: number; low: number; close: number; volume: number;
}

export function calcRSI(closes: number[], period = 14): number | null {
  try {
    const result = RSI.calculate({ values: closes, period });
    return result.at(-1) ?? null;
  } catch { return null; }
}

export function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  try {
    const result = MACD.calculate({
      values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
      SimpleMAOscillator: false, SimpleMASignal: false,
    });
    const last = result.at(-1);
    if (!last) return null;
    return { macd: last.MACD ?? 0, signal: last.signal ?? 0, histogram: last.histogram ?? 0 };
  } catch { return null; }
}

export function calcBollinger(closes: number[], period = 20): { upper: number; middle: number; lower: number } | null {
  try {
    const result = BollingerBands.calculate({ values: closes, period, stdDev: 2 });
    const last = result.at(-1);
    if (!last) return null;
    return { upper: last.upper, middle: last.middle, lower: last.lower };
  } catch { return null; }
}

export function calcATR(bars: OHLCVBar[], period = 14): number | null {
  try {
    const result = ATR.calculate({
      high: bars.map(b => b.high),
      low:  bars.map(b => b.low),
      close: bars.map(b => b.close),
      period,
    });
    return result.at(-1) ?? null;
  } catch { return null; }
}

export function calcEMA(closes: number[], period: number): number | null {
  try {
    const result = EMA.calculate({ values: closes, period });
    return result.at(-1) ?? null;
  } catch { return null; }
}

export function calcADX(bars: OHLCVBar[], period = 14): number | null {
  try {
    const result = ADX.calculate({
      high: bars.map(b => b.high),
      low:  bars.map(b => b.low),
      close: bars.map(b => b.close),
      period,
    });
    return result.at(-1)?.adx ?? null;
  } catch { return null; }
}

export function quickSignal(closes: number[], bars: OHLCVBar[]): {
  signal: "BUY" | "SELL" | "NEUTRAL";
  rsi: number | null;
  macd: ReturnType<typeof calcMACD>;
  ema20: number | null;
  ema50: number | null;
} {
  const rsi    = calcRSI(closes);
  const macd   = calcMACD(closes);
  const ema20  = calcEMA(closes, 20);
  const ema50  = calcEMA(closes, 50);
  const price  = closes.at(-1) ?? 0;

  let bull = 0, bear = 0;
  if (rsi !== null) { if (rsi < 35) bull++; else if (rsi > 65) bear++; }
  if (macd) { if (macd.macd > macd.signal) bull++; else bear++; }
  if (ema20 && ema50) { if (price > ema20 && ema20 > ema50) bull++; else if (price < ema20 && ema20 < ema50) bear++; }

  const signal = bull > bear ? "BUY" : bear > bull ? "SELL" : "NEUTRAL";
  return { signal, rsi, macd, ema20, ema50 };
}
