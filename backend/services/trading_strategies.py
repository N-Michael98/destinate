"""
Trading Strategies Engine — 15 professionelle Strategien
Jede Strategie gibt zurück:
  signal     : LONG / SHORT / NEUTRAL
  confidence : 0-100
  entry      : Einstiegspreis
  sl         : Stop Loss
  tp         : Take Profit
  reasoning  : Begründung

Alle Berechnungen basieren auf echten OHLCV-Daten via yfinance.
Kein Math.random(), keine Simulation.
"""

import logging
import numpy as np
import pandas as pd
import ta
from typing import Optional
from services.market_data import get_ohlcv

logger = logging.getLogger(__name__)

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

def _load(symbol: str, interval: str = "1h", period: str = "3mo") -> pd.DataFrame:
    candles = get_ohlcv(symbol, interval, period)
    if not candles or len(candles) < 30:
        return pd.DataFrame()
    df = pd.DataFrame(candles)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df.set_index("timestamp", inplace=True)
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna(subset=["close"])


def _last(series: pd.Series) -> Optional[float]:
    s = series.dropna()
    return round(float(s.iloc[-1]), 6) if not s.empty else None


def _atr(df: pd.DataFrame, period: int = 14) -> float:
    val = _last(ta.volatility.AverageTrueRange(df["high"], df["low"], df["close"], window=period).average_true_range())
    return val or float(df["close"].iloc[-1]) * 0.005


def _neutral(reason: str) -> dict:
    return {"signal": "NEUTRAL", "confidence": 0, "entry": 0, "sl": 0, "tp": 0, "reasoning": reason}


def _result(signal: str, confidence: int, entry: float, sl: float, tp: float, reasoning: str) -> dict:
    return {
        "signal":     signal,
        "confidence": max(0, min(100, confidence)),
        "entry":      round(entry, 6),
        "sl":         round(sl, 6),
        "tp":         round(tp, 6),
        "reasoning":  reasoning,
    }


# ── 1. Price Action ───────────────────────────────────────────────────────────

def strategy_price_action(symbol: str) -> dict:
    """
    Analyse der letzten 3 Kerzen: Higher Highs/Lower Lows, Inside Bars, Pin Bars.
    Saubere Trendstruktur ohne Indikatoren.
    """
    df = _load(symbol, "4h", "1mo")
    if df.empty or len(df) < 10:
        return _neutral("Zu wenig Daten")

    c = df["close"].values
    h = df["high"].values
    l = df["low"].values
    atr = _atr(df)
    price = float(c[-1])

    # Higher Highs + Higher Lows → Uptrend
    hh = h[-1] > h[-2] > h[-3]
    hl = l[-1] > l[-2] > l[-3]
    # Lower Highs + Lower Lows → Downtrend
    lh = h[-1] < h[-2] < h[-3]
    ll = l[-1] < l[-2] < l[-3]

    # Pin Bar: kleine Kerze body, langer Schatten (Rejection)
    body = abs(c[-1] - df["open"].values[-1])
    lower_wick = df["open"].values[-1] - l[-1] if df["open"].values[-1] > c[-1] else c[-1] - l[-1]
    upper_wick = h[-1] - max(c[-1], df["open"].values[-1])
    bullish_pin = lower_wick > body * 2 and body < atr * 0.5
    bearish_pin = upper_wick > body * 2 and body < atr * 0.5

    if hh and hl:
        conf = 70 + (10 if bullish_pin else 0)
        return _result("LONG", conf, price, price - atr * 1.5, price + atr * 3,
                       f"Higher Highs+Higher Lows Uptrend | ATR={atr:.5f}" + (" | Bullish Pin Bar" if bullish_pin else ""))
    elif lh and ll:
        conf = 70 + (10 if bearish_pin else 0)
        return _result("SHORT", conf, price, price + atr * 1.5, price - atr * 3,
                       f"Lower Highs+Lower Lows Downtrend | ATR={atr:.5f}" + (" | Bearish Pin Bar" if bearish_pin else ""))
    elif bullish_pin:
        return _result("LONG", 60, price, price - atr * 2, price + atr * 3,
                       f"Bullish Pin Bar Rejection (langer unterer Wick) | ATR={atr:.5f}")
    elif bearish_pin:
        return _result("SHORT", 60, price, price + atr * 2, price - atr * 3,
                       f"Bearish Pin Bar Rejection (langer oberer Wick) | ATR={atr:.5f}")
    return _neutral("Keine klare Price-Action Struktur")


# ── 2. Trend Following ────────────────────────────────────────────────────────

def strategy_trend_following(symbol: str) -> dict:
    """
    EMA 50/200 Crossover + ADX Trendstärke.
    Nur Trades in Trendrichtung wenn ADX > 25.
    """
    df = _load(symbol, "1d", "6mo")
    if df.empty or len(df) < 50:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    ema50  = _last(ta.trend.EMAIndicator(close, window=50).ema_indicator())
    ema200 = _last(ta.trend.EMAIndicator(close, window=200).ema_indicator()) if len(df) >= 200 else None
    adx    = _last(ta.trend.ADXIndicator(df["high"], df["low"], close, window=14).adx())
    macd_v = _last(ta.trend.MACD(close).macd())
    macd_s = _last(ta.trend.MACD(close).macd_signal())

    if not all([ema50, adx]):
        return _neutral("Indikator-Fehler")

    trend_strong = adx > 25
    macd_bull = macd_v and macd_s and macd_v > macd_s
    macd_bear = macd_v and macd_s and macd_v < macd_s

    above_ema200 = price > ema200 if ema200 else None

    if price > ema50 and trend_strong and macd_bull:
        conf = 72 + (8 if above_ema200 else 0) + int(min(adx - 25, 15))
        return _result("LONG", conf, price, price - atr * 2, price + atr * 4,
                       f"Preis > EMA50 | ADX={adx:.1f} (stark) | MACD bullish" + (f" | Über EMA200" if above_ema200 else ""))
    elif price < ema50 and trend_strong and macd_bear:
        conf = 72 + (8 if above_ema200 is False else 0) + int(min(adx - 25, 15))
        return _result("SHORT", conf, price, price + atr * 2, price - atr * 4,
                       f"Preis < EMA50 | ADX={adx:.1f} (stark) | MACD bearish")
    elif price > ema50 and not trend_strong:
        return _neutral(f"Über EMA50 aber ADX={adx:.1f} zu schwach für Trend-Trade")
    return _neutral(f"Kein klarer Trend (ADX={adx:.1f})")


# ── 3. Breakout Trading ───────────────────────────────────────────────────────

def strategy_breakout(symbol: str) -> dict:
    """
    Donchian Channel 20-Perioden Breakout + Volumen-Bestätigung.
    """
    df = _load(symbol, "4h", "2mo")
    if df.empty or len(df) < 25:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    high  = df["high"]
    low   = df["low"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    # 20-Bar Donchian
    don_high = float(high.iloc[-21:-1].max())
    don_low  = float(low.iloc[-21:-1].min())
    don_mid  = (don_high + don_low) / 2

    # Volumen-Bestätigung: heute > 20-Bar Durchschnitt?
    vol_ok = True
    if "volume" in df.columns and df["volume"].iloc[-1] > 0:
        vol_avg = float(df["volume"].iloc[-21:-1].mean())
        vol_today = float(df["volume"].iloc[-1])
        vol_ok = vol_today > vol_avg * 1.2

    # ATR-basierte Range — kein Breakout wenn Markt zu volatil
    channel_width = don_high - don_low
    breakout_margin = atr * 0.2

    if price > don_high + breakout_margin:
        conf = 70 + (10 if vol_ok else 0)
        return _result("LONG", conf, price, don_high - atr, price + channel_width * 0.8,
                       f"Breakout über Donchian-High {don_high:.5f} | Kanal={channel_width:.5f}" + (" | Volumen bestätigt" if vol_ok else ""))
    elif price < don_low - breakout_margin:
        conf = 70 + (10 if vol_ok else 0)
        return _result("SHORT", conf, price, don_low + atr, price - channel_width * 0.8,
                       f"Breakout unter Donchian-Low {don_low:.5f} | Kanal={channel_width:.5f}" + (" | Volumen bestätigt" if vol_ok else ""))
    return _neutral(f"Preis im Donchian-Kanal [{don_low:.5f} - {don_high:.5f}]")


# ── 4. Mean Reversion ─────────────────────────────────────────────────────────

def strategy_mean_reversion(symbol: str) -> dict:
    """
    RSI extremes + Bollinger-Band Berührung. Nur in Ranging-Märkten (ADX < 20).
    """
    df = _load(symbol, "1h", "1mo")
    if df.empty or len(df) < 25:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    rsi   = _last(ta.momentum.RSIIndicator(close, window=14).rsi())
    adx   = _last(ta.trend.ADXIndicator(df["high"], df["low"], close, window=14).adx())
    bb    = ta.volatility.BollingerBands(close, window=20)
    bb_up = _last(bb.bollinger_hband())
    bb_lo = _last(bb.bollinger_lband())
    bb_mi = _last(bb.bollinger_mavg())

    if not all([rsi, adx, bb_up, bb_lo]):
        return _neutral("Indikator-Fehler")

    # Mean Reversion nur in Seitwärtsmärkten
    if adx > 25:
        return _neutral(f"ADX={adx:.1f} — Trendmarkt, kein Mean Reversion Trade")

    if rsi < 30 and price <= bb_lo:
        conf = 65 + int((30 - rsi) * 1.5)
        return _result("LONG", min(85, conf), price, price - atr * 1.5, bb_mi,
                       f"RSI={rsi:.1f} oversold + Preis unter BB-Lower {bb_lo:.5f} | ADX={adx:.1f}")
    elif rsi > 70 and price >= bb_up:
        conf = 65 + int((rsi - 70) * 1.5)
        return _result("SHORT", min(85, conf), price, price + atr * 1.5, bb_mi,
                       f"RSI={rsi:.1f} overbought + Preis über BB-Upper {bb_up:.5f} | ADX={adx:.1f}")
    return _neutral(f"RSI={rsi:.1f} | ADX={adx:.1f} — kein Extremwert für Mean Reversion")


# ── 5. Momentum ───────────────────────────────────────────────────────────────

def strategy_momentum(symbol: str) -> dict:
    """
    RSI-Momentum + ROC (Rate of Change) + MACD Histogram Momentum.
    """
    df = _load(symbol, "4h", "2mo")
    if df.empty or len(df) < 30:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    rsi  = _last(ta.momentum.RSIIndicator(close, window=14).rsi())
    roc  = _last(ta.momentum.ROCIndicator(close, window=10).roc())
    macd = ta.trend.MACD(close)
    hist = _last(macd.macd_diff())

    if not all([rsi, roc is not None]):
        return _neutral("Indikator-Fehler")

    bull_count = 0
    bear_count = 0
    reasons = []

    if rsi > 55:
        bull_count += 1
        reasons.append(f"RSI={rsi:.1f} bullish")
    elif rsi < 45:
        bear_count += 1
        reasons.append(f"RSI={rsi:.1f} bearish")

    if roc > 0.5:
        bull_count += 1
        reasons.append(f"ROC={roc:.2f}% positiv")
    elif roc < -0.5:
        bear_count += 1
        reasons.append(f"ROC={roc:.2f}% negativ")

    if hist and hist > 0:
        bull_count += 1
        reasons.append(f"MACD-Hist={hist:.5f} steigt")
    elif hist and hist < 0:
        bear_count += 1
        reasons.append(f"MACD-Hist={hist:.5f} fällt")

    if bull_count >= 2:
        conf = 60 + bull_count * 8
        return _result("LONG", min(85, conf), price, price - atr * 1.8, price + atr * 3.5,
                       " | ".join(reasons))
    elif bear_count >= 2:
        conf = 60 + bear_count * 8
        return _result("SHORT", min(85, conf), price, price + atr * 1.8, price - atr * 3.5,
                       " | ".join(reasons))
    return _neutral(f"Momentum unklar: bull={bull_count} bear={bear_count}")


# ── 6. Scalping ───────────────────────────────────────────────────────────────

def strategy_scalping(symbol: str) -> dict:
    """
    EMA 9/21 Crossover auf 15min + Stochastic für Einstieg.
    Enges SL (0.5×ATR), kleines TP (1×ATR).
    """
    df = _load(symbol, "15m", "5d")
    if df.empty or len(df) < 25:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df, 7)
    price = float(close.iloc[-1])

    ema9  = ta.trend.EMAIndicator(close, window=9).ema_indicator()
    ema21 = ta.trend.EMAIndicator(close, window=21).ema_indicator()
    stoch = ta.momentum.StochasticOscillator(df["high"], df["low"], close, window=14)
    stoch_k = _last(stoch.stoch())
    stoch_d = _last(stoch.stoch_signal())

    e9 = _last(ema9)
    e21 = _last(ema21)
    e9_prev = float(ema9.dropna().iloc[-2]) if len(ema9.dropna()) > 1 else None
    e21_prev = float(ema21.dropna().iloc[-2]) if len(ema21.dropna()) > 1 else None

    if not all([e9, e21, e9_prev, e21_prev, stoch_k, stoch_d]):
        return _neutral("Indikator-Fehler")

    # Frischer Crossover
    just_crossed_up   = e9 > e21 and e9_prev <= e21_prev
    just_crossed_down = e9 < e21 and e9_prev >= e21_prev

    if just_crossed_up and stoch_k < 80:
        return _result("LONG", 68, price, price - atr * 0.5, price + atr * 1.0,
                       f"EMA 9/21 Bull-Crossover | Stoch-K={stoch_k:.1f} | 15min")
    elif just_crossed_down and stoch_k > 20:
        return _result("SHORT", 68, price, price + atr * 0.5, price - atr * 1.0,
                       f"EMA 9/21 Bear-Crossover | Stoch-K={stoch_k:.1f} | 15min")
    elif e9 > e21 and stoch_k < 30:
        return _result("LONG", 62, price, price - atr * 0.5, price + atr * 1.0,
                       f"EMA Trend bullish + Stoch oversold ({stoch_k:.1f}) | 15min")
    elif e9 < e21 and stoch_k > 70:
        return _result("SHORT", 62, price, price + atr * 0.5, price - atr * 1.0,
                       f"EMA Trend bearish + Stoch overbought ({stoch_k:.1f}) | 15min")
    return _neutral(f"EMA9={e9:.5f} EMA21={e21:.5f} | kein Scalp-Signal")


# ── 7. Support & Resistance ───────────────────────────────────────────────────

def strategy_support_resistance(symbol: str) -> dict:
    """
    Identifiziert S/R Level aus Pivot Points (letzte 20 Hochs/Tiefs).
    Bounce-Trade vom Level + RSI-Bestätigung.
    """
    df = _load(symbol, "4h", "3mo")
    if df.empty or len(df) < 30:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    high  = df["high"]
    low   = df["low"]
    atr = _atr(df)
    price = float(close.iloc[-1])
    rsi = _last(ta.momentum.RSIIndicator(close, window=14).rsi())

    # Pivot-basierte S/R: lokale Hochs/Tiefs der letzten 50 Kerzen
    window = min(50, len(df) - 1)
    highs = high.iloc[-window:]
    lows  = low.iloc[-window:]

    # Signifikante Level: mehr als 2× in der Zone berührt
    tolerance = atr * 1.5
    resistance_zone = highs.max()
    support_zone = lows.min()

    near_resistance = abs(price - resistance_zone) < tolerance
    near_support    = abs(price - support_zone)    < tolerance

    # Schritt 2 (26.07.): S/R-Levels EXPLIZIT mitgeben (nicht nur im Text) —
    # damit der Scanner/GPT die konkreten Zonen und den Abstand kennt.
    levels = {
        "support": round(float(support_zone), 6),
        "resistance": round(float(resistance_zone), 6),
        "price": round(price, 6),
        "atr": round(atr, 6),
        # Abstand in ATR: <1.0 = Preis klebt an der Zone (kein Einstieg in
        # Zonen-Richtung, erst Breakout/Rejection + Retest abwarten)
        "dist_to_resistance_atr": round((resistance_zone - price) / atr, 2) if atr > 0 else None,
        "dist_to_support_atr": round((price - support_zone) / atr, 2) if atr > 0 else None,
    }

    if near_support and rsi and rsi < 45:
        conf = 65 + int((45 - rsi))
        r = _result("LONG", min(82, conf), price, support_zone - atr, price + atr * 3,
                    f"Bounce von Support {support_zone:.5f} | RSI={rsi:.1f} | Toleranz={tolerance:.5f}")
    elif near_resistance and rsi and rsi > 55:
        conf = 65 + int(rsi - 55)
        r = _result("SHORT", min(82, conf), price, resistance_zone + atr, price - atr * 3,
                    f"Rejection von Resistance {resistance_zone:.5f} | RSI={rsi:.1f}")
    else:
        r = _neutral(f"Preis {price:.5f} nicht nah an S ({support_zone:.5f}) oder R ({resistance_zone:.5f})")
    r["levels"] = levels
    return r


# ── 8. Candlestick Patterns ───────────────────────────────────────────────────

def strategy_candlestick_patterns(symbol: str) -> dict:
    """
    TA-Lib Candlestick Pattern Recognition: Hammer, Engulfing, Morning/Evening Star, Doji.
    """
    df = _load(symbol, "4h", "1mo")
    if df.empty or len(df) < 10:
        return _neutral("Zu wenig Daten")

    try:
        import talib
        o = df["open"].values.astype(float)
        h = df["high"].values.astype(float)
        l = df["low"].values.astype(float)
        c = df["close"].values.astype(float)

        patterns_bull = {
            "Hammer":              int(talib.CDLHAMMER(o, h, l, c)[-1]),
            "Bullish Engulfing":   int(talib.CDLENGULFING(o, h, l, c)[-1]),
            "Morning Star":        int(talib.CDLMORNINGSTAR(o, h, l, c, penetration=0)[-1]),
            "Three White Soldiers":int(talib.CDL3WHITESOLDIERS(o, h, l, c)[-1]),
            "Piercing Line":       int(talib.CDLPIERCING(o, h, l, c)[-1]),
            "Bullish Marubozu":    int(talib.CDLMARUBOZU(o, h, l, c)[-1]) if talib.CDLMARUBOZU(o, h, l, c)[-1] > 0 else 0,
        }
        patterns_bear = {
            "Shooting Star":       int(talib.CDLSHOOTINGSTAR(o, h, l, c)[-1]),
            "Bearish Engulfing":   abs(int(talib.CDLENGULFING(o, h, l, c)[-1])) if talib.CDLENGULFING(o, h, l, c)[-1] < 0 else 0,
            "Evening Star":        int(talib.CDLEVENINGSTAR(o, h, l, c, penetration=0)[-1]),
            "Three Black Crows":   abs(int(talib.CDL3BLACKCROWS(o, h, l, c)[-1])),
            "Dark Cloud Cover":    abs(int(talib.CDLDARKCLOUDCOVER(o, h, l, c, penetration=0)[-1])),
            "Bearish Marubozu":    abs(int(talib.CDLMARUBOZU(o, h, l, c)[-1])) if talib.CDLMARUBOZU(o, h, l, c)[-1] < 0 else 0,
        }

        bull_patterns = [k for k, v in patterns_bull.items() if v > 0]
        bear_patterns = [k for k, v in patterns_bear.items() if v > 0]

        atr = _atr(df)
        price = float(c[-1])

        if bull_patterns:
            conf = 60 + len(bull_patterns) * 10
            return _result("LONG", min(85, conf), price, price - atr * 1.5, price + atr * 3,
                           f"Bullische Muster: {', '.join(bull_patterns)}")
        elif bear_patterns:
            conf = 60 + len(bear_patterns) * 10
            return _result("SHORT", min(85, conf), price, price + atr * 1.5, price - atr * 3,
                           f"Bärische Muster: {', '.join(bear_patterns)}")
        return _neutral("Keine signifikanten Candlestick-Muster erkannt")

    except ImportError:
        # Fallback: manuelle Hammer/Engulfing Erkennung
        o = df["open"].values
        h = df["high"].values
        l = df["low"].values
        c = df["close"].values
        atr = _atr(df)
        price = float(c[-1])
        body = abs(c[-1] - o[-1])
        lower_wick = min(o[-1], c[-1]) - l[-1]
        bullish_engulf = c[-1] > o[-2] and o[-1] < c[-2] and c[-2] < o[-2]
        bearish_engulf = c[-1] < o[-2] and o[-1] > c[-2] and c[-2] > o[-2]
        hammer = lower_wick > body * 2 and body < atr * 0.5

        if bullish_engulf or hammer:
            return _result("LONG", 65, price, price - atr * 1.5, price + atr * 3,
                           "Bullish Engulfing" if bullish_engulf else "Hammer")
        elif bearish_engulf:
            return _result("SHORT", 65, price, price + atr * 1.5, price - atr * 3, "Bearish Engulfing")
        return _neutral("Kein Muster erkannt (TA-Lib nicht installiert)")


# ── 9. Moving Average Crossover ───────────────────────────────────────────────

def strategy_ma_crossover(symbol: str) -> dict:
    """
    Goldenes/Todeskreuz: EMA 20/50 oder SMA 50/200 je nach Timeframe.
    """
    df = _load(symbol, "1d", "1y")
    if df.empty or len(df) < 55:
        return _neutral("Zu wenig Daten für MA Crossover")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    ema20 = ta.trend.EMAIndicator(close, window=20).ema_indicator()
    ema50 = ta.trend.EMAIndicator(close, window=50).ema_indicator()

    e20 = _last(ema20)
    e50 = _last(ema50)
    e20_prev = float(ema20.dropna().iloc[-2]) if len(ema20.dropna()) > 1 else None
    e50_prev = float(ema50.dropna().iloc[-2]) if len(ema50.dropna()) > 1 else None

    if not all([e20, e50, e20_prev, e50_prev]):
        return _neutral("Indikator-Fehler")

    just_golden = e20 > e50 and e20_prev <= e50_prev  # Goldenes Kreuz
    just_death  = e20 < e50 and e20_prev >= e50_prev  # Todeskreuz
    above_cross = e20 > e50  # Langfristig bullish
    below_cross = e20 < e50  # Langfristig bearish

    if just_golden:
        return _result("LONG", 82, price, price - atr * 2, price + atr * 5,
                       f"🌟 Goldenes Kreuz: EMA20 ({e20:.5f}) kreuzt EMA50 ({e50:.5f}) nach oben")
    elif just_death:
        return _result("SHORT", 82, price, price + atr * 2, price - atr * 5,
                       f"💀 Todeskreuz: EMA20 ({e20:.5f}) kreuzt EMA50 ({e50:.5f}) nach unten")
    elif above_cross:
        return _result("LONG", 65, price, e50 - atr, price + atr * 3,
                       f"EMA20 ({e20:.5f}) > EMA50 ({e50:.5f}) — bullisher Trend bestätigt")
    elif below_cross:
        return _result("SHORT", 65, price, e50 + atr, price - atr * 3,
                       f"EMA20 ({e20:.5f}) < EMA50 ({e50:.5f}) — bearisher Trend bestätigt")
    return _neutral("EMAs gleichauf")


# ── 10. Donchian Channel ──────────────────────────────────────────────────────

def strategy_donchian_channel(symbol: str) -> dict:
    """
    Donchian Channel 20 + 55 Perioden. Trade auf Breakout oder Midline-Bounce.
    """
    df = _load(symbol, "1d", "6mo")
    if df.empty or len(df) < 60:
        return _neutral("Zu wenig Daten")

    h = df["high"]
    l = df["low"]
    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    # 20-Bar Channel
    don20_high = float(h.iloc[-21:-1].max())
    don20_low  = float(l.iloc[-21:-1].min())
    don20_mid  = (don20_high + don20_low) / 2

    # 55-Bar Channel (Turtle-System)
    don55_high = float(h.iloc[-56:-1].max())
    don55_low  = float(l.iloc[-56:-1].min())

    margin = atr * 0.1

    if price > don55_high + margin:
        return _result("LONG", 75, price, don20_low, price + (don55_high - don55_low) * 0.7,
                       f"Turtle Breakout über 55-Bar High {don55_high:.5f}")
    elif price < don55_low - margin:
        return _result("SHORT", 75, price, don20_high, price - (don55_high - don55_low) * 0.7,
                       f"Turtle Breakout unter 55-Bar Low {don55_low:.5f}")
    elif price > don20_high + margin:
        return _result("LONG", 68, price, don20_mid, price + (don20_high - don20_low) * 0.8,
                       f"20-Bar Breakout über {don20_high:.5f}")
    elif price < don20_low - margin:
        return _result("SHORT", 68, price, don20_mid, price - (don20_high - don20_low) * 0.8,
                       f"20-Bar Breakout unter {don20_low:.5f}")
    elif abs(price - don20_mid) < atr * 0.3:
        return _neutral(f"Preis nahe Donchian-Mittellinie {don20_mid:.5f} — warten")
    return _neutral(f"Preis {price:.5f} im Kanal [{don20_low:.5f}-{don20_high:.5f}]")


# ── 11. Bollinger Band Squeeze ────────────────────────────────────────────────

def strategy_bb_squeeze(symbol: str) -> dict:
    """
    Bollinger Band Squeeze: wenn BB-Breite < 20-Bar Minimum → Vola-Ausbruch erwartet.
    Richtung via EMA-Trend.
    """
    df = _load(symbol, "4h", "2mo")
    if df.empty or len(df) < 25:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
    bb_up  = bb.bollinger_hband()
    bb_lo  = bb.bollinger_lband()
    bb_wid = bb_up - bb_lo
    ema20  = ta.trend.EMAIndicator(close, window=20).ema_indicator()
    ema50  = ta.trend.EMAIndicator(close, window=50).ema_indicator()

    bw_last = _last(bb_wid)
    bw_min  = float(bb_wid.iloc[-20:].min()) if len(bb_wid.dropna()) >= 20 else None
    e20 = _last(ema20)
    e50 = _last(ema50)

    if not all([bw_last, bw_min, e20, e50]):
        return _neutral("Indikator-Fehler")

    # Squeeze: aktuelle Breite nahe historischem Minimum
    squeeze = bw_last <= bw_min * 1.05
    trend_bull = e20 > e50
    trend_bear = e20 < e50

    bb_up_v = _last(bb_up)
    bb_lo_v = _last(bb_lo)

    if squeeze and trend_bull:
        return _result("LONG", 78, price, e20 - atr, bb_up_v or price + atr * 3,
                       f"BB Squeeze ({bw_last:.5f} ≈ Min {bw_min:.5f}) + EMA bullish — Ausbruch nach oben erwartet")
    elif squeeze and trend_bear:
        return _result("SHORT", 78, price, e20 + atr, bb_lo_v or price - atr * 3,
                       f"BB Squeeze ({bw_last:.5f} ≈ Min {bw_min:.5f}) + EMA bearish — Ausbruch nach unten erwartet")
    elif price >= bb_up_v and e20 > e50:
        return _neutral(f"Preis über BB-Upper — überkauft, kein Einstieg")
    elif price <= bb_lo_v and e20 < e50:
        return _neutral(f"Preis unter BB-Lower — überverkauft, kein Einstieg")
    return _neutral(f"Kein Squeeze (BB-Breite={bw_last:.5f} > Min={bw_min:.5f})")


# ── 12. RSI Divergence ────────────────────────────────────────────────────────

def strategy_rsi_divergence(symbol: str) -> dict:
    """
    Bullische/Bärische RSI-Divergenz: Preis macht neues Low/High aber RSI nicht.
    """
    df = _load(symbol, "4h", "2mo")
    if df.empty or len(df) < 30:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])
    rsi_series = ta.momentum.RSIIndicator(close, window=14).rsi()

    # Letzte 20 Bars für Divergenz-Check
    recent_c   = close.iloc[-20:].values
    recent_rsi = rsi_series.iloc[-20:].dropna().values

    if len(recent_rsi) < 10:
        return _neutral("Zu wenig RSI-Werte")

    price_low   = float(close.iloc[-20:-1].min())
    price_high  = float(close.iloc[-20:-1].max())
    rsi_at_low  = float(rsi_series.iloc[close.iloc[-20:-1].argmin() - 20])
    rsi_at_high = float(rsi_series.iloc[close.iloc[-20:-1].argmax() - 20])
    rsi_now     = float(recent_rsi[-1])

    # Bullische Divergenz: Preis neues Low, RSI höheres Low
    bullish_div = (price < price_low * 1.001) and (rsi_now > rsi_at_low + 3)
    # Bärische Divergenz: Preis neues High, RSI niedrigeres High
    bearish_div = (price > price_high * 0.999) and (rsi_now < rsi_at_high - 3)

    if bullish_div:
        return _result("LONG", 76, price, price - atr * 1.5, price + atr * 3,
                       f"Bullische RSI-Divergenz: Preis tiefer ({price:.5f} < {price_low:.5f}) aber RSI höher ({rsi_now:.1f} > {rsi_at_low:.1f})")
    elif bearish_div:
        return _result("SHORT", 76, price, price + atr * 1.5, price - atr * 3,
                       f"Bärische RSI-Divergenz: Preis höher ({price:.5f} > {price_high:.5f}) aber RSI tiefer ({rsi_now:.1f} < {rsi_at_high:.1f})")
    return _neutral(f"Keine RSI-Divergenz | RSI={rsi_now:.1f} Preis={price:.5f}")


# ── 13. MACD Strategy ─────────────────────────────────────────────────────────

def strategy_macd(symbol: str) -> dict:
    """
    MACD Crossover + Histogram-Momentum + Null-Linien-Crossover.
    """
    df = _load(symbol, "4h", "3mo")
    if df.empty or len(df) < 35:
        return _neutral("Zu wenig Daten")

    close = df["close"]
    atr = _atr(df)
    price = float(close.iloc[-1])

    macd_ind = ta.trend.MACD(close, window_slow=26, window_fast=12, window_sign=9)
    macd_line = macd_ind.macd()
    signal    = macd_ind.macd_signal()
    histogram = macd_ind.macd_diff()

    m  = _last(macd_line)
    s  = _last(signal)
    h  = _last(histogram)
    m_prev = float(macd_line.dropna().iloc[-2]) if len(macd_line.dropna()) > 1 else None
    s_prev = float(signal.dropna().iloc[-2]) if len(signal.dropna()) > 1 else None

    if not all([m, s, m_prev, s_prev]):
        return _neutral("Indikator-Fehler")

    # Crossover Detection
    bullish_cross = m > s and m_prev <= s_prev
    bearish_cross = m < s and m_prev >= s_prev

    # Zero Line Cross
    zero_bull = m > 0 and m_prev <= 0
    zero_bear = m < 0 and m_prev >= 0

    # Histogram Momentum
    hist_growing_bull = h and h > 0 and abs(h) > abs(float(histogram.dropna().iloc[-2])) if len(histogram.dropna()) > 1 else False

    if bullish_cross and m > 0:
        return _result("LONG", 80, price, price - atr * 1.5, price + atr * 3.5,
                       f"MACD Bull-Crossover über Zero-Line | MACD={m:.5f} Signal={s:.5f}")
    elif bullish_cross:
        return _result("LONG", 70, price, price - atr * 1.5, price + atr * 3,
                       f"MACD Bull-Crossover unter Zero-Line | MACD={m:.5f} Signal={s:.5f}")
    elif bearish_cross and m < 0:
        return _result("SHORT", 80, price, price + atr * 1.5, price - atr * 3.5,
                       f"MACD Bear-Crossover unter Zero-Line | MACD={m:.5f} Signal={s:.5f}")
    elif bearish_cross:
        return _result("SHORT", 70, price, price + atr * 1.5, price - atr * 3,
                       f"MACD Bear-Crossover über Zero-Line | MACD={m:.5f} Signal={s:.5f}")
    elif zero_bull:
        return _result("LONG", 72, price, price - atr * 2, price + atr * 4,
                       f"MACD kreuzt Zero-Line nach oben (bullish)")
    elif zero_bear:
        return _result("SHORT", 72, price, price + atr * 2, price - atr * 4,
                       f"MACD kreuzt Zero-Line nach unten (bearish)")
    return _neutral(f"MACD={m:.5f} Signal={s:.5f} — kein Crossover")


# ── 14. ICT / Smart Money ─────────────────────────────────────────────────────

def strategy_ict_smart_money(symbol: str) -> dict:
    """
    ICT-Konzepte: Fair Value Gaps (FVG), Order Blocks, Break of Structure (BOS).
    BOS: wenn Preis über letztes Swing-High bricht (bullish) oder unter Swing-Low (bearish).
    FVG: Lücke zwischen Kerze[-3].high und Kerze[-1].low (bullish) oder umgekehrt.
    """
    df = _load(symbol, "4h", "1mo")
    if df.empty or len(df) < 20:
        return _neutral("Zu wenig Daten")

    o = df["open"].values
    h = df["high"].values
    l = df["low"].values
    c = df["close"].values
    atr = _atr(df)
    price = float(c[-1])

    # ── Break of Structure ────────────────────────────────────────────────
    # Swing High: Kerze deren High höher als 3 Kerzen davor + danach
    swing_highs = []
    swing_lows  = []
    for i in range(3, len(h) - 1):
        if h[i] == max(h[i-3:i+2]):
            swing_highs.append(h[i])
        if l[i] == min(l[i-3:i+2]):
            swing_lows.append(l[i])

    last_sh = swing_highs[-1] if swing_highs else None
    last_sl = swing_lows[-1]  if swing_lows  else None
    prev_sh = swing_highs[-2] if len(swing_highs) > 1 else None
    prev_sl = swing_lows[-2]  if len(swing_lows) > 1 else None

    bos_bull = last_sh and prev_sh and price > last_sh and last_sh > prev_sh
    bos_bear = last_sl and prev_sl and price < last_sl and last_sl < prev_sl

    # ── Fair Value Gap (FVG) ──────────────────────────────────────────────
    # Bullishes FVG: Kerze[-3].high < Kerze[-1].low → Preislücke
    fvg_bull = len(h) >= 3 and h[-3] < l[-1]
    fvg_bear = len(l) >= 3 and l[-3] > h[-1]
    fvg_mid_bull = (h[-3] + l[-1]) / 2 if fvg_bull else None
    fvg_mid_bear = (l[-3] + h[-1]) / 2 if fvg_bear else None

    # ── Order Block: letzte starke Kerze vor Bewegung ────────────────────
    # Bullischer OB: letzte bearishe Kerze bevor starker Anstieg
    ob_bull = c[-3] < o[-3] and c[-2] > o[-2] and c[-1] > o[-1]  # 1 red, dann 2 grün
    ob_bear = c[-3] > o[-3] and c[-2] < o[-2] and c[-1] < o[-1]

    reasons = []
    signal  = "NEUTRAL"
    conf    = 0

    if bos_bull:
        reasons.append(f"BOS bullish: Preis > Swing High {last_sh:.5f}")
        conf += 30
        signal = "LONG"
    if bos_bear:
        reasons.append(f"BOS bearish: Preis < Swing Low {last_sl:.5f}")
        conf += 30
        signal = "SHORT"
    if fvg_bull and signal != "SHORT":
        reasons.append(f"Bullisches FVG [{h[-3]:.5f}-{l[-1]:.5f}]")
        conf += 25
        signal = "LONG"
    if fvg_bear and signal != "LONG":
        reasons.append(f"Bärisches FVG [{h[-1]:.5f}-{l[-3]:.5f}]")
        conf += 25
        signal = "SHORT"
    if ob_bull and signal == "LONG":
        reasons.append("Bullischer Order Block bestätigt")
        conf += 15
    if ob_bear and signal == "SHORT":
        reasons.append("Bärischer Order Block bestätigt")
        conf += 15

    if signal == "LONG" and conf >= 50:
        return _result("LONG", min(88, 55 + conf // 2), price, price - atr * 1.5, price + atr * 3,
                       " | ".join(reasons))
    elif signal == "SHORT" and conf >= 50:
        return _result("SHORT", min(88, 55 + conf // 2), price, price + atr * 1.5, price - atr * 3,
                       " | ".join(reasons))
    return _neutral(f"ICT: Kein klares Setup (BOS={bos_bull or bos_bear}, FVG={fvg_bull or fvg_bear})")


# ── 15. Supply & Demand ───────────────────────────────────────────────────────

def strategy_supply_demand(symbol: str) -> dict:
    """
    Supply/Demand Zonen: starke Impulsbewegungen identifizieren Zonen.
    Preis kehrt zur Zone zurück → Trade in Impulsrichtung.
    """
    df = _load(symbol, "4h", "3mo")
    if df.empty or len(df) < 30:
        return _neutral("Zu wenig Daten")

    o = df["open"].values
    h = df["high"].values
    l = df["low"].values
    c = df["close"].values
    atr = _atr(df)
    price = float(c[-1])
    rsi = _last(ta.momentum.RSIIndicator(df["close"], window=14).rsi())

    demand_zones = []  # (zone_low, zone_high, strength)
    supply_zones = []

    # Impulskerzen identifizieren (Kerze > 2× ATR)
    for i in range(5, len(c) - 2):
        candle_range = h[i] - l[i]
        if candle_range < atr * 1.5:
            continue
        # Starke bullishe Kerze → Demand Zone darunter
        if c[i] > o[i] and (c[i] - o[i]) > candle_range * 0.6:
            zone_low  = l[i]
            zone_high = max(o[i], l[i]) + atr * 0.5
            demand_zones.append((zone_low, zone_high, candle_range / atr))
        # Starke bearishe Kerze → Supply Zone darüber
        elif o[i] > c[i] and (o[i] - c[i]) > candle_range * 0.6:
            zone_low  = min(o[i], h[i]) - atr * 0.5
            zone_high = h[i]
            supply_zones.append((zone_low, zone_high, candle_range / atr))

    # Preis in Demand-Zone?
    for zone_low, zone_high, strength in sorted(demand_zones, key=lambda x: -x[2]):
        if zone_low <= price <= zone_high * 1.02:
            conf = 62 + int(min(strength * 5, 20))
            return _result("LONG", min(84, conf), price, zone_low - atr * 0.5, price + atr * 4,
                           f"Demand Zone [{zone_low:.5f}-{zone_high:.5f}] Stärke={strength:.1f}× ATR | RSI={rsi:.1f}" if rsi else f"Demand Zone [{zone_low:.5f}-{zone_high:.5f}]")

    # Preis in Supply-Zone?
    for zone_low, zone_high, strength in sorted(supply_zones, key=lambda x: -x[2]):
        if zone_low * 0.98 <= price <= zone_high:
            conf = 62 + int(min(strength * 5, 20))
            return _result("SHORT", min(84, conf), price, zone_high + atr * 0.5, price - atr * 4,
                           f"Supply Zone [{zone_low:.5f}-{zone_high:.5f}] Stärke={strength:.1f}× ATR | RSI={rsi:.1f}" if rsi else f"Supply Zone [{zone_low:.5f}-{zone_high:.5f}]")

    return _neutral(f"Preis {price:.5f} nicht in bekannter S/D-Zone (Zonen gefunden: {len(demand_zones)}D / {len(supply_zones)}S)")


# ── Alle Strategien kombinieren ────────────────────────────────────────────────

STRATEGIES: dict[str, callable] = {
    "price_action":      strategy_price_action,
    "trend_following":   strategy_trend_following,
    "breakout":          strategy_breakout,
    "mean_reversion":    strategy_mean_reversion,
    "momentum":          strategy_momentum,
    "scalping":          strategy_scalping,
    "support_resistance":strategy_support_resistance,
    "candlestick":       strategy_candlestick_patterns,
    "ma_crossover":      strategy_ma_crossover,
    "donchian":          strategy_donchian_channel,
    "bb_squeeze":        strategy_bb_squeeze,
    "rsi_divergence":    strategy_rsi_divergence,
    "macd":              strategy_macd,
    "ict_smart_money":   strategy_ict_smart_money,
    "supply_demand":     strategy_supply_demand,
}


def analyze_all_strategies(symbol: str) -> dict:
    """
    Führt alle 15 Strategien aus und gibt aggregiertes Ergebnis zurück.
    """
    sym = symbol.upper()
    results: dict[str, dict] = {}

    for name, fn in STRATEGIES.items():
        try:
            results[name] = fn(sym)
        except Exception as e:
            logger.warning(f"[strategies] {sym}/{name} Fehler: {e}")
            results[name] = _neutral(f"Fehler: {str(e)[:60]}")

    # Aggregierter Score
    long_count  = sum(1 for r in results.values() if r["signal"] == "LONG")
    short_count = sum(1 for r in results.values() if r["signal"] == "SHORT")
    total_voted = long_count + short_count

    if total_voted == 0:
        consensus = "NEUTRAL"
        consensus_conf = 0
    elif long_count > short_count:
        consensus = "LONG"
        consensus_conf = int(long_count / len(STRATEGIES) * 100)
    else:
        consensus = "SHORT"
        consensus_conf = int(short_count / len(STRATEGIES) * 100)

    # Bestes Signal nach Confidence
    best = max(results.values(), key=lambda r: r["confidence"] if r["signal"] != "NEUTRAL" else 0)

    # Konfidenz-gewichteter Gesamt-Score
    conf_scores = [r["confidence"] for r in results.values() if r["signal"] == consensus] or [0]
    avg_conf = int(np.mean(conf_scores))

    active_strategies = [
        {"strategy": k, **v}
        for k, v in results.items()
        if v["signal"] != "NEUTRAL"
    ]
    active_strategies.sort(key=lambda x: -x["confidence"])

    # Schritt 2 (26.07.): S/R-Levels aus der support_resistance-Strategie nach
    # oben durchreichen — vorher steckten sie nur im reasoning-Text und gingen
    # verloren, sobald die Strategie nicht die Top-1 war.
    sr_levels = (results.get("support_resistance") or {}).get("levels")

    return {
        "symbol":          sym,
        "consensus":       consensus,
        "consensus_conf":  avg_conf,
        "long_votes":      long_count,
        "short_votes":     short_count,
        "neutral_votes":   len(STRATEGIES) - total_voted,
        "total_strategies":len(STRATEGIES),
        "best_strategy":   best,
        "active":          active_strategies,
        "all":             results,
        "levels":          sr_levels,
    }


def analyze_strategies_multi(symbols: list[str]) -> list[dict]:
    return [analyze_all_strategies(sym) for sym in symbols]
