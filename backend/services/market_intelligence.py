"""
Market Intelligence — 5-Ebenen Markt-Analyse
Ebene 1: Technische Analyse    (EMA, RSI, MACD, ADX, Bollinger, ATR)
Ebene 2: Markt-Regime          (Trending/Ranging/Volatile via ADX + ATR)
Ebene 3: Multi-Timeframe       (1h + 4h + 1d Alignment)
Ebene 4: Korrelation           (verwandte Märkte analysieren)
Ebene 5: Gesamt-Score          (kombinierter Signal-Score 0-100)

Output: Signal (BUY/SELL/NEUTRAL) + Score + Begründung
"""

import logging
import numpy as np
import pandas as pd
import ta
from typing import Optional
from services.market_data import get_ohlcv
from services.market_mapper import get_instrument_info, INSTRUMENT_INFO

logger = logging.getLogger(__name__)

# ── Korrelations-Gruppen ─────────────────────────────────────────────────────
# Wenn Symbol A steigt, tendiert Symbol B zu...

CORRELATIONS: dict[str, list[tuple[str, float]]] = {
    "XAUUSD": [("XAGUSD", 0.85), ("USDCHF", -0.70), ("EURUSD", 0.60)],
    "XAGUSD": [("XAUUSD", 0.85), ("USOIL", 0.40)],
    "EURUSD": [("GBPUSD", 0.80), ("XAUUSD", 0.60), ("USDCHF", -0.90)],
    "GBPUSD": [("EURUSD", 0.80), ("GBPJPY", 0.70)],
    "USDJPY": [("GBPJPY", 0.80), ("EURJPY", 0.80)],
    "USOIL":  [("BRENT", 0.97),  ("USDCAD", -0.60)],
    "BRENT":  [("USOIL", 0.97)],
    "US500":  [("NAS100", 0.90), ("US30", 0.85)],
    "NAS100": [("US500", 0.90)],
}

# ── Hilfsfunktion: DataFrame laden ───────────────────────────────────────────

def _load(symbol: str, interval: str, period: str) -> pd.DataFrame:
    candles = get_ohlcv(symbol, interval, period)
    if not candles:
        return pd.DataFrame()
    df = pd.DataFrame(candles)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna(subset=["close"])

def _last(series: pd.Series) -> Optional[float]:
    s = series.dropna()
    return round(float(s.iloc[-1]), 5) if not s.empty else None

# ── Ebene 1: Technische Analyse ───────────────────────────────────────────────

def _technical_analysis(df: pd.DataFrame) -> dict:
    if df.empty or len(df) < 20:
        return {"signal": "NEUTRAL", "score": 50, "reason": "Zu wenig Daten"}

    close = df["close"]
    high  = df["high"]
    low   = df["low"]

    # Indikatoren berechnen
    ema20  = ta.trend.EMAIndicator(close, window=20).ema_indicator()
    ema50  = ta.trend.EMAIndicator(close, window=50).ema_indicator()
    ema200 = ta.trend.EMAIndicator(close, window=200).ema_indicator() if len(df) >= 200 else ema50
    macd   = ta.trend.MACD(close)
    adx    = ta.trend.ADXIndicator(high, low, close)
    rsi    = ta.momentum.RSIIndicator(close, window=14).rsi()
    bb     = ta.volatility.BollingerBands(close, window=20)
    atr    = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()

    price     = _last(close)
    ema20_v   = _last(ema20)
    ema50_v   = _last(ema50)
    ema200_v  = _last(ema200)
    macd_v    = _last(macd.macd())
    macd_sig  = _last(macd.macd_signal())
    adx_v     = _last(adx.adx())
    rsi_v     = _last(rsi)
    bb_upper  = _last(bb.bollinger_hband())
    bb_lower  = _last(bb.bollinger_lband())
    atr_v     = _last(atr)

    if not all([price, ema20_v, rsi_v]):
        return {"signal": "NEUTRAL", "score": 50, "reason": "Indikator-Fehler"}

    bull_signals = 0
    bear_signals = 0
    reasons      = []

    # EMA Trend
    if price > ema20_v > ema50_v:
        bull_signals += 2
        reasons.append("EMA bullish")
    elif price < ema20_v < ema50_v:
        bear_signals += 2
        reasons.append("EMA bearish")

    # EMA200
    if ema200_v:
        if price > ema200_v:
            bull_signals += 1
            reasons.append("Über EMA200")
        else:
            bear_signals += 1
            reasons.append("Unter EMA200")

    # MACD
    if macd_v and macd_sig:
        if macd_v > macd_sig and macd_v > 0:
            bull_signals += 2
            reasons.append("MACD bullish")
        elif macd_v < macd_sig and macd_v < 0:
            bear_signals += 2
            reasons.append("MACD bearish")

    # RSI
    if rsi_v < 35:
        bull_signals += 2
        reasons.append(f"RSI oversold ({rsi_v:.0f})")
    elif rsi_v > 65:
        bear_signals += 2
        reasons.append(f"RSI overbought ({rsi_v:.0f})")
    elif 40 <= rsi_v <= 60:
        reasons.append(f"RSI neutral ({rsi_v:.0f})")

    # Bollinger Bands
    if bb_lower and price <= bb_lower:
        bull_signals += 1
        reasons.append("Preis an BB-Unterband")
    elif bb_upper and price >= bb_upper:
        bear_signals += 1
        reasons.append("Preis an BB-Oberband")

    # ADX Trend-Stärke
    trend_strength = "schwach"
    if adx_v and adx_v > 25:
        trend_strength = "stark"
        if bull_signals > bear_signals:
            bull_signals += 1
        elif bear_signals > bull_signals:
            bear_signals += 1

    total = bull_signals + bear_signals
    if total == 0:
        score = 50
        signal = "NEUTRAL"
    else:
        bull_pct = bull_signals / total
        if bull_pct >= 0.65:
            signal = "BUY"
            score  = int(50 + bull_pct * 50)
        elif bull_pct <= 0.35:
            signal = "SELL"
            score  = int(50 + (1 - bull_pct) * 50)
        else:
            signal = "NEUTRAL"
            score  = 50

    return {
        "signal":   signal,
        "score":    score,
        "adx":      adx_v,
        "rsi":      rsi_v,
        "atr":      atr_v,
        "trend_strength": trend_strength,
        "reason":   " | ".join(reasons),
        "bull_signals": bull_signals,
        "bear_signals": bear_signals,
    }

# ── Ebene 2: Markt-Regime ─────────────────────────────────────────────────────

def _detect_regime(df: pd.DataFrame, tech: dict) -> dict:
    adx  = tech.get("adx", 0) or 0
    atr  = tech.get("atr", 0) or 0

    if atr and len(df) >= 20:
        avg_atr = float(df["close"].pct_change().abs().mean()) * 100
        high_vol = avg_atr > 1.5
    else:
        high_vol = False

    if adx >= 30:
        regime = "TRENDING"
        description = f"Starker Trend (ADX={adx:.0f})"
    elif adx >= 20:
        regime = "WEAK_TREND"
        description = f"Schwacher Trend (ADX={adx:.0f})"
    elif high_vol:
        regime = "VOLATILE"
        description = "Volatiler Markt ohne klaren Trend"
    else:
        regime = "RANGING"
        description = f"Seitwärtsmarkt (ADX={adx:.0f})"

    # Regime-Empfehlung
    trade_ok = regime in ("TRENDING", "WEAK_TREND")

    return {
        "regime":      regime,
        "description": description,
        "trade_ok":    trade_ok,
        "adx":         adx,
    }

# ── Ebene 3: Multi-Timeframe ──────────────────────────────────────────────────

def _multi_timeframe(symbol: str) -> dict:
    results = {}
    timeframes = [("1h", "5d"), ("4h", "1mo"), ("1d", "3mo")]

    for interval, period in timeframes:
        df = _load(symbol, interval, period)
        if not df.empty:
            tech = _technical_analysis(df)
            results[interval] = {
                "signal": tech["signal"],
                "score":  tech["score"],
            }
        else:
            results[interval] = {"signal": "NEUTRAL", "score": 50}

    # Alignment Score: alle Timeframes gleiche Richtung?
    signals = [r["signal"] for r in results.values()]
    scores  = [r["score"]  for r in results.values()]

    buy_count  = signals.count("BUY")
    sell_count = signals.count("SELL")

    if buy_count == 3:
        alignment = "STRONG_BUY"
        alignment_score = 90
    elif sell_count == 3:
        alignment = "STRONG_SELL"
        alignment_score = 10
    elif buy_count >= 2:
        alignment = "BUY"
        alignment_score = 70
    elif sell_count >= 2:
        alignment = "SELL"
        alignment_score = 30
    else:
        alignment = "MIXED"
        alignment_score = 50

    return {
        "timeframes":       results,
        "alignment":        alignment,
        "alignment_score":  alignment_score,
        "avg_score":        int(np.mean(scores)),
    }

# ── Ebene 4: Korrelation ──────────────────────────────────────────────────────

def _correlation_check(symbol: str, main_signal: str) -> dict:
    corr_list = CORRELATIONS.get(symbol.upper(), [])
    if not corr_list:
        return {"confirmed": True, "details": [], "boost": 0}

    confirmations = []
    boost = 0

    for corr_symbol, corr_factor in corr_list[:3]:
        df_c = _load(corr_symbol, "1h", "5d")
        if df_c.empty:
            continue
        tech_c = _technical_analysis(df_c)
        corr_signal = tech_c["signal"]

        # Positive Korrelation: beide gleiche Richtung
        if corr_factor > 0:
            confirms = corr_signal == main_signal
        else:
            # Negative Korrelation: entgegengesetzte Richtung
            opposite = "SELL" if main_signal == "BUY" else "BUY"
            confirms = corr_signal == opposite

        if confirms:
            boost += abs(corr_factor) * 5
            confirmations.append(f"{corr_symbol} bestätigt ({corr_signal})")
        else:
            boost -= abs(corr_factor) * 3
            confirmations.append(f"{corr_symbol} widerspricht ({corr_signal})")

    return {
        "confirmed": boost >= 0,
        "details":   confirmations,
        "boost":     int(boost),
    }

# ── Ebene 5: Gesamt-Score ─────────────────────────────────────────────────────

def _combine_scores(tech: dict, regime: dict, mtf: dict, corr: dict) -> dict:
    tech_score = tech.get("score", 50)
    mtf_score  = mtf.get("alignment_score", 50)
    corr_boost = corr.get("boost", 0)

    # Gewichtung: Technik 40%, MTF 40%, Korrelation 20%
    base_score = int(tech_score * 0.40 + mtf_score * 0.40 + 50 * 0.20)
    final_score = max(0, min(100, base_score + corr_boost))

    # Regime dämpft Signal wenn ranging
    if regime.get("regime") == "RANGING" and final_score != 50:
        final_score = int(50 + (final_score - 50) * 0.6)

    if final_score >= 75:
        signal = "BUY"
    elif final_score <= 25:
        signal = "SELL"
    else:
        signal = "NEUTRAL"

    confidence = max(0, min(100, abs(final_score - 50) * 2))

    return {
        "signal":     signal,
        "score":      final_score,
        "confidence": confidence,
    }

# ── Haupt-Funktion ────────────────────────────────────────────────────────────

def analyze(symbol: str) -> dict:
    """
    Vollständige 5-Ebenen Analyse für ein Symbol.
    Gibt Signal (BUY/SELL/NEUTRAL) + Score (0-100) + Confidence zurück.
    """
    sym = symbol.upper()
    logger.info(f"[intelligence] Analysiere {sym}")

    # Ebene 1: Technisch (1h)
    df_1h = _load(sym, "1h", "5d")
    tech  = _technical_analysis(df_1h)

    # Ebene 2: Regime
    regime = _detect_regime(df_1h, tech)

    # Ebene 3: Multi-Timeframe
    mtf = _multi_timeframe(sym)

    # Ebene 4: Korrelation
    corr = _correlation_check(sym, tech["signal"])

    # Ebene 5: Gesamt
    combined = _combine_scores(tech, regime, mtf, corr)

    return {
        "symbol":   sym,
        "signal":   combined["signal"],
        "score":    combined["score"],
        "confidence": combined["confidence"],
        "layers": {
            "technical":       tech,
            "regime":          regime,
            "multi_timeframe": mtf,
            "correlation":     corr,
        },
        "trade_recommended": combined["signal"] != "NEUTRAL" and regime["trade_ok"],
    }

def analyze_multi(symbols: list[str]) -> list[dict]:
    results = []
    for sym in symbols:
        try:
            results.append(analyze(sym))
        except Exception as e:
            logger.error(f"[intelligence] Fehler bei {sym}: {e}")
            results.append({"symbol": sym, "signal": "NEUTRAL", "score": 50, "error": str(e)})
    return results
