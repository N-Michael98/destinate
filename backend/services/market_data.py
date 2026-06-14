import yfinance as yf
import pandas as pd
from typing import Optional

# Symbol-Mapping: Trading-Symbole → Yahoo Finance Symbole
SYMBOL_MAP = {
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "USDCHF": "USDCHF=X",
    "AUDUSD": "AUDUSD=X",
    "NZDUSD": "NZDUSD=X",
    "USDCAD": "USDCAD=X",
    "EURGBP": "EURGBP=X",
    "EURJPY": "EURJPY=X",
    "XAUUSD": "GC=F",       # Gold Futures
    "XAGUSD": "SI=F",       # Silver Futures
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "US30":   "^DJI",       # Dow Jones
    "NAS100": "^NDX",       # Nasdaq 100
    "SPX500": "^GSPC",      # S&P 500
    "GER40":  "^GDAXI",     # DAX
    "UK100":  "^FTSE",      # FTSE 100
    "OIL":    "CL=F",       # Crude Oil
}

VALID_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"}
VALID_PERIODS   = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"}

def _resolve(symbol: str) -> str:
    return SYMBOL_MAP.get(symbol.upper(), symbol.upper())

def get_current_price(symbol: str) -> dict:
    ticker = yf.Ticker(_resolve(symbol))
    info = ticker.fast_info
    price = getattr(info, "last_price", None)
    return {
        "symbol": symbol.upper(),
        "price": round(float(price), 5) if price else None,
        "currency": getattr(info, "currency", "USD"),
    }

def get_ohlcv(
    symbol: str,
    interval: str = "1h",
    period: str = "5d",
) -> list[dict]:
    if interval not in VALID_INTERVALS:
        raise ValueError(f"Invalid interval: {interval}")
    if period not in VALID_PERIODS:
        raise ValueError(f"Invalid period: {period}")

    ticker = yf.Ticker(_resolve(symbol))
    df: pd.DataFrame = ticker.history(period=period, interval=interval)

    # Fallback: try shorter period if no data returned
    if df.empty and period in ("1mo", "3mo", "6mo"):
        df = ticker.history(period="5d", interval=interval)
    if df.empty and interval == "1h":
        df = ticker.history(period="5d", interval="1d")
    if df.empty:
        return []

    df.index = pd.to_datetime(df.index)
    records = []
    for ts, row in df.iterrows():
        records.append({
            "timestamp": ts.isoformat(),
            "open":   round(float(row["Open"]),   5),
            "high":   round(float(row["High"]),   5),
            "low":    round(float(row["Low"]),    5),
            "close":  round(float(row["Close"]),  5),
            "volume": int(row["Volume"]),
        })
    return records

def get_multi_price(symbols: list[str]) -> list[dict]:
    results = []
    for sym in symbols:
        try:
            results.append(get_current_price(sym))
        except Exception as e:
            results.append({"symbol": sym.upper(), "price": None, "error": str(e)})
    return results
