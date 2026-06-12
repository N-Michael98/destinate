"""
Historische Hochauflösungs-Daten (1-Minuten OHLCV)
Primär: yfinance 1m-Daten (bis 7 Tage zurück, zuverlässig)
Dukascopy-Format-kompatibler Output für nahtlose Integration.
"""

import pandas as pd
import yfinance as yf
from datetime import datetime, timezone, timedelta
from typing import Optional

SYMBOL_MAP = {
    "EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X", "USDJPY": "USDJPY=X",
    "USDCHF": "USDCHF=X", "XAUUSD": "GC=F",     "BTCUSD": "BTC-USD",
    "USDCAD": "USDCAD=X", "AUDUSD": "AUDUSD=X",  "NAS100": "^NDX",
    "OIL":    "CL=F",     "SPX500": "^GSPC",
}

SUPPORTED = list(SYMBOL_MAP.keys())


def get_tick_data(symbol: str, hours: int = 6, end: Optional[datetime] = None) -> list[dict]:
    """
    Gibt Hochauflösungs-Preisdaten (1-Minuten) zurück.
    Simuliert Tick-Daten aus 1m-OHLCV-Kerzen (bid/ask aus Open/Close).
    """
    ticker = SYMBOL_MAP.get(symbol.upper())
    if not ticker:
        return []

    period_hours = min(hours, 167)  # yfinance 1m max 7 Tage
    end_dt = end or datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(hours=period_hours)
    try:
        df = yf.download(ticker, start=start_dt, end=end_dt, interval="1m", progress=False, auto_adjust=True)
        if df is None or df.empty:
            return []

        ticks = []
        for ts, row in df.iterrows():
            try:
                ts_aware = ts.to_pydatetime()
                if ts_aware.tzinfo is None:
                    ts_aware = ts_aware.replace(tzinfo=timezone.utc)
                mid = float(row["Close"].iloc[0] if hasattr(row["Close"], "iloc") else row["Close"])
                spread = mid * 0.00015  # typischer Forex-Spread ~1.5 Pips
                ticks.append({
                    "timestamp": ts_aware.isoformat(),
                    "timestamp_ms": int(ts_aware.timestamp() * 1000),
                    "ask": round(mid + spread / 2, 5),
                    "bid": round(mid - spread / 2, 5),
                    "mid": round(mid, 5),
                    "open": round(float(row["Open"].iloc[0] if hasattr(row["Open"], "iloc") else row["Open"]), 5),
                    "high": round(float(row["High"].iloc[0] if hasattr(row["High"], "iloc") else row["High"]), 5),
                    "low":  round(float(row["Low"].iloc[0] if hasattr(row["Low"], "iloc") else row["Low"]), 5),
                    "volume": int(row["Volume"].iloc[0] if hasattr(row["Volume"], "iloc") else row["Volume"]) if "Volume" in row else 0,
                    "source": "YFINANCE_1M",
                })
            except Exception:
                continue
        return ticks
    except Exception:
        return []


def ticks_to_ohlcv(ticks: list[dict], interval_minutes: int = 60) -> list[dict]:
    """Aggregiert Tick-/1m-Daten zu OHLCV-Kerzen der gewünschten Zeiteinheit."""
    if not ticks:
        return []
    interval_ms = interval_minutes * 60 * 1000
    buckets: dict[int, list[dict]] = {}
    for t in ticks:
        bucket = (t["timestamp_ms"] // interval_ms) * interval_ms
        if bucket not in buckets:
            buckets[bucket] = []
        buckets[bucket].append(t)

    candles = []
    for ts_ms in sorted(buckets):
        bars = buckets[ts_ms]
        opens  = [b["open"] for b in bars]
        highs  = [b["high"] for b in bars]
        lows   = [b["low"]  for b in bars]
        closes = [b["mid"]  for b in bars]
        candles.append({
            "timestamp": datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat(),
            "open":   round(opens[0], 5),
            "high":   round(max(highs), 5),
            "low":    round(min(lows), 5),
            "close":  round(closes[-1], 5),
            "volume": sum(b.get("volume", 0) for b in bars),
            "bars":   len(bars),
            "source": "YFINANCE_1M_AGGREGATED",
        })
    return candles
