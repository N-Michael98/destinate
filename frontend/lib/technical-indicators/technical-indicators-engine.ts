import type {
  IndicatorSummary, TechnicalAnalysisReport,
  EMAResult, RSIResult, MACDResult, BollingerBandsResult,
  ATRResult, StochasticResult, VWAPResult, SMAResult,
  IndicatorSignal, IndicatorStrength,
} from "./technical-indicators-types";

// ── Deterministic pseudo-price generator ─────────────────────────────────────
function seedRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const BASE_PRICES: Record<string, number> = {
  XAUUSD: 2340.0,
  EURUSD: 1.0850,
  NAS100: 19200.0,
  USOIL: 78.50,
  BTCUSD: 67500.0,
  SPX500: 5450.0,
};

function generatePriceSeries(symbol: string, length = 200): number[] {
  const base = BASE_PRICES[symbol] ?? 1000;
  const rng = seedRandom(symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const prices: number[] = [base];
  const volatility = base * 0.003;
  for (let i = 1; i < length; i++) {
    const change = (rng() - 0.49) * volatility * 2;
    prices.push(Math.max(prices[i - 1] + change, base * 0.8));
  }
  return prices;
}

// ── Indicator Calculations ────────────────────────────────────────────────────
function calcEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(5));
}

function calcSMA(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(5));
}

function calcRSI(prices: number[], period = 14): number {
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calcATR(prices: number[], period = 14): number {
  const trues: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i] * 1.002;
    const low = prices[i] * 0.998;
    const prevClose = prices[i - 1];
    trues.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return parseFloat((trues.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(5));
}

function signalFromPrice(price: number, ema: number, rsi: number): IndicatorSignal {
  if (price > ema && rsi < 70) return "BUY";
  if (price < ema && rsi > 30) return "SELL";
  return "NEUTRAL";
}

function strengthFromRSI(rsi: number): IndicatorStrength {
  if (rsi > 65 || rsi < 35) return "STRONG";
  if (rsi > 60 || rsi < 40) return "MODERATE";
  return "WEAK";
}

// ── Build full indicator summary for one symbol ───────────────────────────────
function buildIndicatorSummary(symbol: string, timeframe: string): IndicatorSummary {
  const prices = generatePriceSeries(symbol, 220);
  const current = prices[prices.length - 1];

  const ema9v = calcEMA(prices, 9);
  const ema21v = calcEMA(prices, 21);
  const ema50v = calcEMA(prices, 50);
  const ema200v = calcEMA(prices, 200);

  const sma20v = calcSMA(prices, 20);
  const sma50v = calcSMA(prices, 50);
  const sma200v = calcSMA(prices, 200);

  const rsiValue = calcRSI(prices, 14);
  const atrValue = calcATR(prices, 14);

  // EMA crossovers
  const emaShortVsLong = ema9v > ema21v ? "GOLDEN" : "DEATH";

  const macdLine = parseFloat((ema9v - ema26(prices)).toFixed(5));
  const signalLineVal = parseFloat((macdLine * 0.9).toFixed(5));
  const histogram = parseFloat((macdLine - signalLineVal).toFixed(5));

  const stdDev = calcStdDev(prices, 20);
  const bbMiddle = sma20v;
  const bbUpper = parseFloat((bbMiddle + 2 * stdDev).toFixed(5));
  const bbLower = parseFloat((bbMiddle - 2 * stdDev).toFixed(5));
  const bbWidth = parseFloat(((bbUpper - bbLower) / bbMiddle).toFixed(5));
  const percentB = parseFloat(((current - bbLower) / (bbUpper - bbLower)).toFixed(3));

  // Stochastic
  const highestHigh = Math.max(...prices.slice(-14)) * 1.002;
  const lowestLow = Math.min(...prices.slice(-14)) * 0.998;
  const kValue = parseFloat((((current - lowestLow) / (highestHigh - lowestLow)) * 100).toFixed(2));
  const dValue = parseFloat((kValue * 0.95 + 2).toFixed(2));

  // Overall signal
  const signals: IndicatorSignal[] = [
    current > ema50v ? "BUY" : "SELL",
    current > ema200v ? "BUY" : "SELL",
    rsiValue < 70 && rsiValue > 30 ? signalFromPrice(current, ema21v, rsiValue) : rsiValue >= 70 ? "SELL" : "BUY",
    macdLine > signalLineVal ? "BUY" : "SELL",
    current > bbMiddle ? "BUY" : "SELL",
  ];
  const bullishCount = signals.filter((s) => s === "BUY").length;
  const bearishCount = signals.filter((s) => s === "SELL").length;
  const neutralCount = signals.filter((s) => s === "NEUTRAL").length;
  const confluenceScore = Math.round((bullishCount / signals.length) * 100);
  const overallSignal: IndicatorSignal = bullishCount > bearishCount ? "BUY" : bearishCount > bullishCount ? "SELL" : "NEUTRAL";
  const overallStrength: IndicatorStrength = Math.abs(bullishCount - bearishCount) >= 3 ? "STRONG" : Math.abs(bullishCount - bearishCount) >= 2 ? "MODERATE" : "WEAK";

  const ema9: EMAResult = {
    period: 9,
    value: ema9v,
    signal: ema9v > ema21v ? "BUY" : "SELL",
    crossover: emaShortVsLong,
  };
  const ema21: EMAResult = {
    period: 21,
    value: ema21v,
    signal: current > ema21v ? "BUY" : "SELL",
    crossover: ema21v > ema50v ? "GOLDEN" : "DEATH",
  };
  const ema50: EMAResult = {
    period: 50,
    value: ema50v,
    signal: current > ema50v ? "BUY" : "SELL",
    crossover: ema50v > ema200v ? "GOLDEN" : "DEATH",
  };
  const ema200: EMAResult = {
    period: 200,
    value: ema200v,
    signal: current > ema200v ? "BUY" : "SELL",
    crossover: "NONE",
  };

  const sma20: SMAResult = { period: 20, value: sma20v, signal: current > sma20v ? "BUY" : "SELL" };
  const sma50: SMAResult = { period: 50, value: sma50v, signal: current > sma50v ? "BUY" : "SELL" };
  const sma200: SMAResult = { period: 200, value: sma200v, signal: current > sma200v ? "BUY" : "SELL" };

  const rsi: RSIResult = {
    period: 14,
    value: rsiValue,
    signal: rsiValue > 70 ? "SELL" : rsiValue < 30 ? "BUY" : "NEUTRAL",
    zone: rsiValue > 70 ? "OVERBOUGHT" : rsiValue < 30 ? "OVERSOLD" : "NEUTRAL",
    strength: strengthFromRSI(rsiValue),
  };

  const macd: MACDResult = {
    macdLine,
    signalLine: signalLineVal,
    histogram,
    signal: macdLine > signalLineVal ? "BUY" : "SELL",
    crossover: macdLine > signalLineVal ? "BULLISH" : "BEARISH",
    strength: Math.abs(histogram) > atrValue * 0.01 ? "STRONG" : "MODERATE",
  };

  const bollingerBands: BollingerBandsResult = {
    upper: bbUpper,
    middle: bbMiddle,
    lower: bbLower,
    bandwidth: bbWidth,
    percentB,
    signal: percentB > 0.8 ? "SELL" : percentB < 0.2 ? "BUY" : "NEUTRAL",
    squeeze: bbWidth < 0.02,
  };

  const suggestedStopPips = parseFloat((atrValue * 1.5).toFixed(5));
  const atr: ATRResult = {
    period: 14,
    value: atrValue,
    volatilityLevel: atrValue > current * 0.008 ? "EXTREME" : atrValue > current * 0.005 ? "HIGH" : atrValue > current * 0.002 ? "MEDIUM" : "LOW",
    suggestedStopPips,
  };

  const stochastic: StochasticResult = {
    kPeriod: 14,
    dPeriod: 3,
    kValue,
    dValue,
    signal: kValue > 80 ? "SELL" : kValue < 20 ? "BUY" : "NEUTRAL",
    zone: kValue > 80 ? "OVERBOUGHT" : kValue < 20 ? "OVERSOLD" : "NEUTRAL",
    crossover: kValue > dValue ? "BULLISH" : kValue < dValue ? "BEARISH" : "NONE",
  };

  const vwap: VWAPResult = {
    value: parseFloat((sma20v * 1.001).toFixed(5)),
    signal: current > sma20v * 1.001 ? "BUY" : "SELL",
    priceRelation: current > sma20v * 1.001 ? "ABOVE" : current < sma20v * 0.999 ? "BELOW" : "AT",
  };

  return {
    symbol,
    timeframe,
    currentPrice: parseFloat(current.toFixed(symbol === "EURUSD" ? 5 : 2)),
    overallSignal,
    overallStrength,
    bullishCount,
    bearishCount,
    neutralCount,
    confluenceScore,
    ema: { ema9, ema21, ema50, ema200 },
    sma: { sma20, sma50, sma200 },
    rsi,
    macd,
    bollingerBands,
    atr,
    stochastic,
    vwap,
    generatedAt: new Date().toISOString(),
  };
}

function ema26(prices: number[]): number {
  return calcEMA(prices, 26);
}

function calcStdDev(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  return Math.sqrt(variance);
}

// ── Public engine function ────────────────────────────────────────────────────
export function generateTechnicalAnalysisReport(
  symbols = ["XAUUSD", "EURUSD", "NAS100", "USOIL", "BTCUSD", "SPX500"],
  timeframe = "H1"
): TechnicalAnalysisReport {
  const summaries = symbols.map((s) => buildIndicatorSummary(s, timeframe));

  const topBullish = summaries
    .filter((s) => s.overallSignal === "BUY")
    .sort((a, b) => b.confluenceScore - a.confluenceScore)
    .map((s) => s.symbol);

  const topBearish = summaries
    .filter((s) => s.overallSignal === "SELL")
    .sort((a, b) => a.confluenceScore - b.confluenceScore)
    .map((s) => s.symbol);

  const bullishTotal = summaries.filter((s) => s.overallSignal === "BUY").length;
  const bearishTotal = summaries.filter((s) => s.overallSignal === "SELL").length;

  const marketBias =
    bullishTotal > bearishTotal + 1 ? "RISK_ON" :
    bearishTotal > bullishTotal + 1 ? "RISK_OFF" :
    bullishTotal === bearishTotal ? "MIXED" : "NEUTRAL";

  return {
    version: "V17.2.0",
    symbols: summaries,
    topBullish,
    topBearish,
    marketBias,
    generatedAt: new Date().toISOString(),
  };
}
