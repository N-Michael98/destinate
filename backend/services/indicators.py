import pandas as pd
import numpy as np
import ta
from services.market_data import get_ohlcv

def _load_df(symbol: str, interval: str = "1h", period: str = "3mo") -> pd.DataFrame:
    candles = get_ohlcv(symbol, interval, period)
    if not candles:
        return pd.DataFrame()
    df = pd.DataFrame(candles)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)
    return df

def calculate_all(symbol: str, interval: str = "1h", period: str = "3mo") -> dict:
    df = _load_df(symbol, interval, period)
    if df.empty:
        return {"error": "No data available"}

    close = df["close"]
    high  = df["high"]
    low   = df["low"]

    # — Trend —
    ema20  = ta.trend.EMAIndicator(close, window=20).ema_indicator()
    ema50  = ta.trend.EMAIndicator(close, window=50).ema_indicator()
    ema200 = ta.trend.EMAIndicator(close, window=200).ema_indicator()
    macd_i = ta.trend.MACD(close)
    adx_i  = ta.trend.ADXIndicator(high, low, close)

    # — Momentum —
    rsi    = ta.momentum.RSIIndicator(close, window=14).rsi()
    stoch  = ta.momentum.StochasticOscillator(high, low, close)

    # — Volatility —
    bb     = ta.volatility.BollingerBands(close, window=20)
    atr    = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()

    # — Volume —
    obv    = ta.volume.OnBalanceVolumeIndicator(close, df["volume"]).on_balance_volume()

    def last(series: pd.Series) -> float | None:
        val = series.dropna().iloc[-1] if not series.dropna().empty else None
        return round(float(val), 5) if val is not None else None

    current_price = last(close)
    ema20_val  = last(ema20)
    ema50_val  = last(ema50)
    ema200_val = last(ema200)

    # Trend-Richtung bestimmen
    trend = "NEUTRAL"
    if ema20_val and ema50_val and current_price:
        if current_price > ema20_val > ema50_val:
            trend = "BULLISH"
        elif current_price < ema20_val < ema50_val:
            trend = "BEARISH"

    rsi_val = last(rsi)
    rsi_signal = "NEUTRAL"
    if rsi_val:
        if rsi_val >= 70: rsi_signal = "OVERBOUGHT"
        elif rsi_val <= 30: rsi_signal = "OVERSOLD"

    return {
        "symbol":    symbol.upper(),
        "interval":  interval,
        "price":     current_price,
        "trend":     trend,
        "indicators": {
            "ema": {
                "ema20":  ema20_val,
                "ema50":  ema50_val,
                "ema200": ema200_val,
            },
            "macd": {
                "macd":   last(macd_i.macd()),
                "signal": last(macd_i.macd_signal()),
                "hist":   last(macd_i.macd_diff()),
            },
            "adx": {
                "adx":    last(adx_i.adx()),
                "plus_di":  last(adx_i.adx_pos()),
                "minus_di": last(adx_i.adx_neg()),
            },
            "rsi": {
                "value":  rsi_val,
                "signal": rsi_signal,
            },
            "stochastic": {
                "k": last(stoch.stoch()),
                "d": last(stoch.stoch_signal()),
            },
            "bollinger": {
                "upper":  last(bb.bollinger_hband()),
                "middle": last(bb.bollinger_mavg()),
                "lower":  last(bb.bollinger_lband()),
                "width":  last(bb.bollinger_wband()),
            },
            "atr":  last(atr),
            "obv":  last(obv),
        },
        "candles_used": len(df),
    }
