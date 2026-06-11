export type IndicatorSignal = "BUY" | "SELL" | "NEUTRAL";
export type IndicatorStrength = "STRONG" | "MODERATE" | "WEAK";

export interface EMAResult {
  period: number;
  value: number;
  signal: IndicatorSignal;
  crossover: "GOLDEN" | "DEATH" | "NONE";
}

export interface SMAResult {
  period: number;
  value: number;
  signal: IndicatorSignal;
}

export interface RSIResult {
  period: number;
  value: number;
  signal: IndicatorSignal;
  zone: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  strength: IndicatorStrength;
}

export interface MACDResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  signal: IndicatorSignal;
  crossover: "BULLISH" | "BEARISH" | "NONE";
  strength: IndicatorStrength;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
  signal: IndicatorSignal;
  squeeze: boolean;
}

export interface ATRResult {
  period: number;
  value: number;
  volatilityLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  suggestedStopPips: number;
}

export interface StochasticResult {
  kPeriod: number;
  dPeriod: number;
  kValue: number;
  dValue: number;
  signal: IndicatorSignal;
  zone: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  crossover: "BULLISH" | "BEARISH" | "NONE";
}

export interface VWAPResult {
  value: number;
  signal: IndicatorSignal;
  priceRelation: "ABOVE" | "BELOW" | "AT";
}

export interface IndicatorSummary {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  overallSignal: IndicatorSignal;
  overallStrength: IndicatorStrength;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  confluenceScore: number;
  ema: {
    ema9: EMAResult;
    ema21: EMAResult;
    ema50: EMAResult;
    ema200: EMAResult;
  };
  sma: {
    sma20: SMAResult;
    sma50: SMAResult;
    sma200: SMAResult;
  };
  rsi: RSIResult;
  macd: MACDResult;
  bollingerBands: BollingerBandsResult;
  atr: ATRResult;
  stochastic: StochasticResult;
  vwap: VWAPResult;
  generatedAt: string;
}

export interface TechnicalAnalysisReport {
  version: string;
  symbols: IndicatorSummary[];
  topBullish: string[];
  topBearish: string[];
  marketBias: "RISK_ON" | "RISK_OFF" | "NEUTRAL" | "MIXED";
  generatedAt: string;
}
