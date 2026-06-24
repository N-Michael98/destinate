import yfinance as yf
import pandas as pd
from typing import Optional

# Symbol-Mapping: Trading-Symbole → Yahoo Finance Symbole
SYMBOL_MAP = {
    # Forex
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "USDCHF": "USDCHF=X",
    "AUDUSD": "AUDUSD=X",
    "NZDUSD": "NZDUSD=X",
    "USDCAD": "USDCAD=X",
    "EURGBP": "EURGBP=X",
    "EURJPY": "EURJPY=X",
    "GBPJPY": "GBPJPY=X",
    # Commodities
    "XAUUSD": "GC=F",
    "XAGUSD": "SI=F",
    "USOIL":  "CL=F",
    "UKOIL":  "BZ=F",
    "OIL":    "CL=F",
    "NATGAS": "NG=F",
    # Crypto
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "LTCUSD": "LTC-USD",
    "XRPUSD": "XRP-USD",
    "ADAUSD": "ADA-USD",
    "SOLUSD": "SOL-USD",
    "DOTUSD": "DOT-USD",
    "LNKUSD": "LINK-USD",
    "BNBUSD": "BNB-USD",
    # Indices
    "NAS100": "^NDX",
    "SPX500": "^GSPC",
    "GER40":  "^GDAXI",
    "UK100":  "^FTSE",
    "DJ30":   "^DJI",
    "JPN225": "^N225",
    "US30":   "^DJI",
}

VALID_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"}
VALID_PERIODS   = {"1d", "5d", "1mo", "2mo", "3mo", "6mo", "1y", "2y", "5y", "max"}

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
    # "4h" is not a native yfinance interval — resample from 1h data
    if interval == "4h":
        candles_1h = get_ohlcv(symbol, "1h", period)
        if not candles_1h:
            return []
        df_1h = pd.DataFrame(candles_1h)
        df_1h["timestamp"] = pd.to_datetime(df_1h["timestamp"], utc=True)
        df_1h = df_1h.set_index("timestamp")
        df_4h = df_1h.resample("4h").agg({
            "open":   "first",
            "high":   "max",
            "low":    "min",
            "close":  "last",
            "volume": "sum",
        }).dropna(subset=["close"])
        return [
            {
                "timestamp": ts.isoformat(),
                "open":   round(float(row["open"]),   5),
                "high":   round(float(row["high"]),   5),
                "low":    round(float(row["low"]),    5),
                "close":  round(float(row["close"]),  5),
                "volume": int(row["volume"]),
            }
            for ts, row in df_4h.iterrows()
            if pd.notna(row.get("close")) and float(row.get("close", 0)) > 0
        ]

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
    if not symbols:
        return []
    # Batch-Download: alle Symbole in einem einzigen yfinance-Request (viel schneller)
    tickers = [_resolve(s) for s in symbols]
    sym_map = {_resolve(s): s.upper() for s in symbols}
    try:
        df = yf.download(tickers, period="2d", interval="1d", auto_adjust=True, progress=False, threads=True)
        results = []
        if len(tickers) == 1:
            # yf.download gibt bei 1 Symbol keinen MultiIndex zurück
            close = df["Close"] if "Close" in df.columns else None
            price = float(close.dropna().iloc[-1]) if close is not None and not close.dropna().empty else None
            results.append({"symbol": symbols[0].upper(), "price": round(price, 5) if price else None})
        else:
            close_df = df["Close"] if "Close" in df.columns else df
            for ticker, sym_original in sym_map.items():
                try:
                    series = close_df[ticker].dropna() if ticker in close_df.columns else None
                    price = float(series.iloc[-1]) if series is not None and not series.empty else None
                    results.append({"symbol": sym_original, "price": round(price, 5) if price else None})
                except Exception:
                    results.append({"symbol": sym_original, "price": None})
        return results
    except Exception:
        # Fallback: einzeln abrufen
        results = []
        for sym in symbols:
            try:
                results.append(get_current_price(sym))
            except Exception as e:
                results.append({"symbol": sym.upper(), "price": None, "error": str(e)})
        return results
