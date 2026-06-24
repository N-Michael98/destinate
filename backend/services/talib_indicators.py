"""
TA-Lib Professional Indicators — G2C
150+ professionelle Indikatoren via TA-Lib C-Library.
Ergänzt ta library, ersetzt sie nicht.
"""

import logging
import numpy as np
import pandas as pd
from typing import Optional
from services.market_data import get_ohlcv

logger = logging.getLogger(__name__)


_PERIOD_FOR_INTERVAL = {
    "1m": "1d", "2m": "1d", "5m": "5d", "15m": "5d", "30m": "1mo",
    "60m": "3mo", "90m": "3mo", "1h": "3mo", "4h": "6mo",
    "1d": "6mo", "5d": "1y", "1wk": "2y", "1mo": "5y", "3mo": "5y",
}

def _load_arrays(symbol: str, interval: str = "1d", period: str = None):
    """Lädt OHLCV als numpy arrays für TA-Lib."""
    if period is None:
        period = _PERIOD_FOR_INTERVAL.get(interval, "6mo")
    candles = get_ohlcv(symbol, interval, period)
    if not candles or len(candles) < 30:
        return None
    df = pd.DataFrame(candles)
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["close"])
    return {
        "open":   df["open"].values.astype(float),
        "high":   df["high"].values.astype(float),
        "low":    df["low"].values.astype(float),
        "close":  df["close"].values.astype(float),
        "volume": df["volume"].values.astype(float) if "volume" in df.columns else np.zeros(len(df)),
    }


def _safe(val) -> Optional[float]:
    """Konvertiert numpy float zu Python float, None wenn NaN."""
    try:
        v = float(val)
        return None if np.isnan(v) else round(v, 6)
    except Exception:
        return None


def analyze_talib(symbol: str, interval: str = "1d") -> dict:
    """
    Vollständige professionelle TA-Lib Analyse.
    Momentum + Trend + Volatilität + Pattern Recognition.
    """
    try:
        import talib

        data = _load_arrays(symbol, interval)
        if data is None:
            return {"error": "Zu wenig Daten", "symbol": symbol}

        o, h, l, c, v = data["open"], data["high"], data["low"], data["close"], data["volume"]

        # --- Momentum ---
        rsi14   = talib.RSI(c, timeperiod=14)
        rsi7    = talib.RSI(c, timeperiod=7)
        macd, macd_sig, macd_hist = talib.MACD(c, fastperiod=12, slowperiod=26, signalperiod=9)
        stoch_k, stoch_d = talib.STOCH(h, l, c, fastk_period=14, slowk_period=3, slowd_period=3)
        cci     = talib.CCI(h, l, c, timeperiod=14)
        mfi     = talib.MFI(h, l, c, v, timeperiod=14)
        willr   = talib.WILLR(h, l, c, timeperiod=14)
        roc     = talib.ROC(c, timeperiod=10)
        mom     = talib.MOM(c, timeperiod=10)
        adx     = talib.ADX(h, l, c, timeperiod=14)
        plus_di = talib.PLUS_DI(h, l, c, timeperiod=14)
        minus_di= talib.MINUS_DI(h, l, c, timeperiod=14)

        # --- Trend ---
        ema9    = talib.EMA(c, timeperiod=9)
        ema20   = talib.EMA(c, timeperiod=20)
        ema50   = talib.EMA(c, timeperiod=50)
        ema200  = talib.EMA(c, timeperiod=200)
        sma20   = talib.SMA(c, timeperiod=20)
        sma50   = talib.SMA(c, timeperiod=50)
        dema    = talib.DEMA(c, timeperiod=20)
        tema    = talib.TEMA(c, timeperiod=20)
        wma     = talib.WMA(c, timeperiod=20)
        trima   = talib.TRIMA(c, timeperiod=20)
        kama    = talib.KAMA(c, timeperiod=10)

        # --- Volatilität ---
        bb_upper, bb_mid, bb_lower = talib.BBANDS(c, timeperiod=20, nbdevup=2, nbdevdn=2)
        atr14   = talib.ATR(h, l, c, timeperiod=14)
        atr7    = talib.ATR(h, l, c, timeperiod=7)
        natr    = talib.NATR(h, l, c, timeperiod=14)
        trange  = talib.TRANGE(h, l, c)

        # --- Volumen ---
        obv     = talib.OBV(c, v)
        ad      = talib.AD(h, l, c, v)
        adosc   = talib.ADOSC(h, l, c, v, fastperiod=3, slowperiod=10)

        # --- Pattern Recognition (Candlestick) ---
        patterns = {
            "doji":             int(talib.CDLDOJI(o, h, l, c)[-1]),
            "hammer":           int(talib.CDLHAMMER(o, h, l, c)[-1]),
            "engulfing":        int(talib.CDLENGULFING(o, h, l, c)[-1]),
            "morning_star":     int(talib.CDLMORNINGSTAR(o, h, l, c, penetration=0)[-1]),
            "evening_star":     int(talib.CDLEVENINGSTAR(o, h, l, c, penetration=0)[-1]),
            "shooting_star":    int(talib.CDLSHOOTINGSTAR(o, h, l, c)[-1]),
            "three_white_soldiers": int(talib.CDL3WHITESOLDIERS(o, h, l, c)[-1]),
            "three_black_crows":    int(talib.CDL3BLACKCROWS(o, h, l, c)[-1]),
            "marubozu":         int(talib.CDLMARUBOZU(o, h, l, c)[-1]),
        }
        bullish_patterns = [k for k, v in patterns.items() if v > 0]
        bearish_patterns = [k for k, v in patterns.items() if v < 0]

        # --- Signal ableiten ---
        current_price = _safe(c[-1])
        signal_score  = 0

        if _safe(rsi14[-1]) and _safe(rsi14[-1]) < 30:    signal_score += 2
        elif _safe(rsi14[-1]) and _safe(rsi14[-1]) > 70:  signal_score -= 2

        if _safe(macd[-1]) and _safe(macd_sig[-1]):
            if macd[-1] > macd_sig[-1]:  signal_score += 1
            else:                        signal_score -= 1

        if _safe(ema20[-1]) and _safe(ema50[-1]):
            if ema20[-1] > ema50[-1]:    signal_score += 1
            else:                        signal_score -= 1

        if current_price and _safe(ema200[-1]):
            if current_price > ema200[-1]: signal_score += 1
            else:                          signal_score -= 1

        signal_score += len(bullish_patterns)
        signal_score -= len(bearish_patterns)

        if signal_score >= 3:    signal = "STRONG_BUY"
        elif signal_score >= 1:  signal = "BUY"
        elif signal_score <= -3: signal = "STRONG_SELL"
        elif signal_score <= -1: signal = "SELL"
        else:                    signal = "NEUTRAL"

        return {
            "symbol":   symbol,
            "interval": interval,
            "signal":   signal,
            "score":    signal_score,
            "momentum": {
                "rsi_14":   _safe(rsi14[-1]),
                "rsi_7":    _safe(rsi7[-1]),
                "macd":     _safe(macd[-1]),
                "macd_signal": _safe(macd_sig[-1]),
                "macd_hist":   _safe(macd_hist[-1]),
                "stoch_k":  _safe(stoch_k[-1]),
                "stoch_d":  _safe(stoch_d[-1]),
                "cci":      _safe(cci[-1]),
                "mfi":      _safe(mfi[-1]),
                "williams_r": _safe(willr[-1]),
                "roc":      _safe(roc[-1]),
                "momentum": _safe(mom[-1]),
            },
            "trend": {
                "adx":      _safe(adx[-1]),
                "plus_di":  _safe(plus_di[-1]),
                "minus_di": _safe(minus_di[-1]),
                "ema_9":    _safe(ema9[-1]),
                "ema_20":   _safe(ema20[-1]),
                "ema_50":   _safe(ema50[-1]),
                "ema_200":  _safe(ema200[-1]),
                "sma_20":   _safe(sma20[-1]),
                "sma_50":   _safe(sma50[-1]),
                "dema":     _safe(dema[-1]),
                "tema":     _safe(tema[-1]),
                "wma":      _safe(wma[-1]),
                "kama":     _safe(kama[-1]),
                "above_ema200": bool(current_price and _safe(ema200[-1]) and current_price > ema200[-1]),
            },
            "volatility": {
                "bb_upper":  _safe(bb_upper[-1]),
                "bb_middle": _safe(bb_mid[-1]),
                "bb_lower":  _safe(bb_lower[-1]),
                "bb_width":  _safe((bb_upper[-1] - bb_lower[-1]) / bb_mid[-1] * 100) if _safe(bb_mid[-1]) else None,
                "atr_14":    _safe(atr14[-1]),
                "atr_7":     _safe(atr7[-1]),
                "natr":      _safe(natr[-1]),
            },
            "volume": {
                "obv":   _safe(obv[-1]),
                "ad":    _safe(ad[-1]),
                "adosc": _safe(adosc[-1]),
            },
            "patterns": {
                "bullish": bullish_patterns,
                "bearish": bearish_patterns,
                "all":     patterns,
            },
            "price": current_price,
        }

    except ImportError:
        return {"error": "TA-Lib nicht installiert — Dockerfile Build fehlt", "symbol": symbol}
    except Exception as e:
        logger.error(f"[talib] Fehler {symbol}: {e}")
        return {"error": str(e)[:150], "symbol": symbol}


def talib_pattern_scan(symbol: str, interval: str = "1d") -> dict:
    """Scannt alle 61 TA-Lib Candlestick Patterns auf einmal."""
    try:
        import talib

        data = _load_arrays(symbol, interval)
        if data is None:
            return {"error": "Zu wenig Daten", "symbol": symbol}

        o, h, l, c = data["open"], data["high"], data["low"], data["close"]

        all_patterns = [fn for fn in dir(talib) if fn.startswith("CDL")]
        results = {}
        for name in all_patterns:
            try:
                val = int(getattr(talib, name)(o, h, l, c)[-1])
                if val != 0:
                    results[name] = val
            except Exception:
                pass

        bullish = {k: v for k, v in results.items() if v > 0}
        bearish = {k: v for k, v in results.items() if v < 0}

        return {
            "symbol":   symbol,
            "interval": interval,
            "bullish":  bullish,
            "bearish":  bearish,
            "total_signals": len(results),
            "net_score": sum(results.values()),
        }
    except ImportError:
        return {"error": "TA-Lib nicht installiert", "symbol": symbol}
    except Exception as e:
        logger.error(f"[talib-pattern] Fehler {symbol}: {e}")
        return {"error": str(e)[:150], "symbol": symbol}
