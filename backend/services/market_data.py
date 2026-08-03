import yfinance as yf
import pandas as pd
from datetime import datetime, timezone
from typing import Optional

from core.circuit_breaker import yfinance_breaker
from core.retry import api_retry

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

@yfinance_breaker
@api_retry()
def get_current_price(symbol: str) -> dict:
    ticker = yf.Ticker(_resolve(symbol))
    info = ticker.fast_info
    price = getattr(info, "last_price", None)
    return {
        "symbol": symbol.upper(),
        "price": round(float(price), 5) if price else None,
        "currency": getattr(info, "currency", "USD"),
    }

@yfinance_breaker
@api_retry()
def _fetch_ohlcv_single(symbol: str, interval: str, period: str) -> list[dict]:
    """Ein einzelner, echter yfinance-Abruf (kein 4h-Resampling) — Retry+Breaker
    greifen genau hier, EINMAL pro Aufruf."""
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


def get_ohlcv(
    symbol: str,
    interval: str = "1h",
    period: str = "5d",
) -> list[dict]:
    # "4h" is not a native yfinance interval — resample from 1h data.
    # Ruft _fetch_ohlcv_single() DIREKT auf (nicht sich selbst rekursiv) —
    # sonst würden Retry+Breaker doppelt greifen (bis zu 9 statt 3 Versuche
    # bei transienten Fehlern, Nebenfund von Fund #4, 27.07.).
    if interval == "4h":
        candles_1h = _fetch_ohlcv_single(symbol, "1h", period)
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

    return _fetch_ohlcv_single(symbol, interval, period)

@yfinance_breaker
@api_retry()
def _download_multi(tickers: list[str]) -> pd.DataFrame:
    return yf.download(tickers, period="2d", interval="1d", auto_adjust=True, progress=False, threads=True)


@yfinance_breaker
@api_retry()
def _download_multi_intraday(tickers: list[str]) -> pd.DataFrame:
    """1-Minuten-Kerzen — liefern im Gegensatz zur Tageskerze einen ECHTEN
    Zeitstempel des letzten Kurses. Nötig, um Aktualität überhaupt messen zu
    können (Fund 02.08.: vorher wurde jeder Preis im Frontend mit der aktuellen
    Uhrzeit gestempelt, egal wie alt er war)."""
    return yf.download(tickers, period="1d", interval="1m", auto_adjust=True, progress=False, threads=True)


def _series_for(df: pd.DataFrame, ticker: str, single: bool):
    """Close-Serie eines Tickers aus einem yfinance-DataFrame. None wenn leer."""
    try:
        if df is None or df.empty:
            return None
        if single:
            close = df["Close"] if "Close" in df.columns else None
            if close is None:
                return None
            # Bei einem Ticker kann Close selbst ein DataFrame mit einer Spalte sein
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]
            s = close.dropna()
        else:
            close_df = df["Close"] if "Close" in df.columns else df
            if ticker not in close_df.columns:
                return None
            s = close_df[ticker].dropna()
        return s if not s.empty else None
    except Exception:
        return None


def _as_utc_iso(ts) -> Optional[str]:
    """Pandas-Zeitstempel -> ISO-String in UTC. None wenn nicht konvertierbar."""
    try:
        dt = ts.to_pydatetime()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None

def get_multi_price(symbols: list[str]) -> list[dict]:
    """Kurse mit ECHTEM Zeitstempel (asOf) und Alter in Minuten (ageMinutes).

    Fund 02.08.: Vorher wurde nur die Tageskerze geholt und im Frontend mit der
    aktuellen Uhrzeit gestempelt — ein 57 Stunden alter Nikkei-Kurs sah damit
    taufrisch aus. Da die gesamte Analyse und jeder Einstieg auf diesen Kursen
    beruht, muss messbar sein, wie alt ein Kurs wirklich ist.

    Drei Stufen, damit KEIN Symbol verloren geht (live geprüft: Gold GC=F und
    Öl CL=F liefern zeitweise gar keine 1-Minuten-Daten):
      1. 1-Minuten-Kerzen  -> exakter Zeitstempel, frischester Kurs
      2. Tageskerzen       -> nur für Symbole ohne 1m-Daten, Zeitstempel = Tag
      3. Einzelabruf       -> bestehender Notfall-Rückfall, ohne Zeitstempel

    asOfPrecision: "minute" = exakt | "day" = nur Tagesschluss | null = unbekannt.
    Bei unbekanntem Zeitstempel bleibt ageMinutes None — der Aufrufer darf das
    NICHT als "frisch" werten (fail-safe).
    """
    if not symbols:
        return []
    tickers = [_resolve(s) for s in symbols]
    sym_map = {_resolve(s): s.upper() for s in symbols}
    now = datetime.now(timezone.utc)
    found: dict[str, dict] = {}

    def _record(sym_original: str, price, ts, precision: Optional[str]) -> None:
        as_of = _as_utc_iso(ts) if ts is not None else None
        age = None
        if as_of:
            try:
                age = round((now - datetime.fromisoformat(as_of)).total_seconds() / 60, 1)
            except Exception:
                age = None
        found[sym_original] = {
            "symbol": sym_original,
            "price": round(float(price), 5) if price is not None else None,
            "asOf": as_of,
            "ageMinutes": age,
            "asOfPrecision": precision,
        }

    # ── Stufe 1: 1-Minuten-Kerzen (exakter Zeitstempel) ──────────────────────
    try:
        df = _download_multi_intraday(tickers)
        single = len(tickers) == 1
        for ticker, sym_original in sym_map.items():
            s = _series_for(df, ticker, single)
            if s is not None:
                _record(sym_original, s.iloc[-1], s.index[-1], "minute")
    except Exception:
        pass  # non-fatal — Stufe 2 fängt alles auf

    # ── Stufe 2: Tageskerzen für alles was noch fehlt ────────────────────────
    missing = [t for t, o in sym_map.items() if found.get(o, {}).get("price") is None]
    if missing:
        try:
            df = _download_multi(missing)
            single = len(missing) == 1
            for ticker in missing:
                sym_original = sym_map[ticker]
                s = _series_for(df, ticker, single)
                if s is not None:
                    _record(sym_original, s.iloc[-1], s.index[-1], "day")
        except Exception:
            pass

    # ── Stufe 3: Einzelabruf als letzter Rückfall ────────────────────────────
    still_missing = [sym_map[t] for t in tickers if found.get(sym_map[t], {}).get("price") is None]
    for sym_original in still_missing:
        try:
            single_res = get_current_price(sym_original)
            found[sym_original] = {
                "symbol": sym_original,
                "price": single_res.get("price"),
                "asOf": None,
                "ageMinutes": None,   # unbekannt -> Aufrufer behandelt als NICHT frisch
                "asOfPrecision": None,
            }
        except Exception as e:
            found[sym_original] = {
                "symbol": sym_original, "price": None, "asOf": None,
                "ageMinutes": None, "asOfPrecision": None, "error": str(e),
            }

    return [found[sym_map[t]] for t in tickers]


