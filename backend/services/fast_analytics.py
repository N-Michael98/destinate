"""
Fast Analytics — polars
10x schnellere Datenverarbeitung als pandas.
Für Performance-kritische Berechnungen: Indikator-Batch, Multi-Symbol Analyse.
"""

import logging
from typing import Optional
from services.market_data import get_ohlcv

logger = logging.getLogger(__name__)


def _to_polars(symbol: str, interval: str = "1d", period: str = "1y"):
    """Lädt OHLCV Daten als polars DataFrame."""
    try:
        import polars as pl
        candles = get_ohlcv(symbol, interval, period)
        if not candles or len(candles) < 10:
            return None
        df = pl.DataFrame(candles)
        for col in ["open", "high", "low", "close", "volume"]:
            if col in df.columns:
                df = df.with_columns(pl.col(col).cast(pl.Float64))
        return df
    except ImportError:
        logger.warning("[fast-analytics] polars nicht installiert")
        return None
    except Exception as e:
        logger.error(f"[fast-analytics] Daten Fehler {symbol}: {e}")
        return None


def fast_indicators(symbol: str, interval: str = "1d") -> dict:
    """
    Berechnet RSI, EMA, Bollinger Bands via polars — 10x schneller als pandas.
    """
    try:
        import polars as pl

        df = _to_polars(symbol, interval)
        if df is None:
            return {"error": "Zu wenig Daten", "symbol": symbol}

        close = df["close"]

        # EMA via polars ewm_mean
        ema20 = close.ewm_mean(span=20, adjust=False)
        ema50 = close.ewm_mean(span=50, adjust=False)
        ema200 = close.ewm_mean(span=200, adjust=False)

        # RSI via polars
        delta = close.diff()
        gain = delta.map_elements(lambda x: x if x > 0 else 0.0, return_dtype=pl.Float64)
        loss = delta.map_elements(lambda x: -x if x < 0 else 0.0, return_dtype=pl.Float64)
        avg_gain = gain.ewm_mean(span=14, adjust=False)
        avg_loss = loss.ewm_mean(span=14, adjust=False)
        rs = avg_gain / avg_loss.map_elements(lambda x: x if x != 0 else 1e-10, return_dtype=pl.Float64)
        rsi = 100 - (100 / (1 + rs))

        # Bollinger Bands
        sma20 = close.rolling_mean(window_size=20)
        std20 = close.rolling_std(window_size=20)
        bb_upper = sma20 + (std20 * 2)
        bb_lower = sma20 - (std20 * 2)

        # Returns
        returns = close.pct_change()
        vol_20 = returns.rolling_std(window_size=20)

        def _last(series) -> Optional[float]:
            try:
                val = series[-1]
                return round(float(val), 6) if val is not None else None
            except Exception:
                return None

        price = _last(close)
        e20 = _last(ema20)
        e50 = _last(ema50)

        signal = "NEUTRAL"
        if _last(rsi) and _last(rsi) < 30 and e20 and e50 and e20 > e50:
            signal = "BUY"
        elif _last(rsi) and _last(rsi) > 70 and e20 and e50 and e20 < e50:
            signal = "SELL"

        return {
            "symbol":     symbol,
            "interval":   interval,
            "signal":     signal,
            "engine":     "polars",
            "price":      price,
            "rsi_14":     _last(rsi),
            "ema_20":     e20,
            "ema_50":     e50,
            "ema_200":    _last(ema200),
            "bb_upper":   _last(bb_upper),
            "bb_middle":  _last(sma20),
            "bb_lower":   _last(bb_lower),
            "volatility": _last(vol_20),
            "rows":       len(df),
        }

    except ImportError:
        return {"error": "polars nicht installiert", "symbol": symbol}
    except Exception as e:
        logger.error(f"[fast-analytics] Fehler {symbol}: {e}")
        return {"error": str(e)[:100], "symbol": symbol}


def fast_multi_symbol(symbols: list[str], interval: str = "1d") -> list[dict]:
    """
    Analysiert mehrere Symbole mit polars — schnell und effizient.
    """
    return [fast_indicators(s, interval) for s in symbols]


def fast_correlation_matrix(symbols: list[str], period: str = "3mo") -> dict:
    """
    Berechnet Korrelations-Matrix für mehrere Symbole via polars.
    Wichtig für Portfolio-Diversifikation.
    """
    try:
        import polars as pl

        frames = {}
        for sym in symbols:
            df = _to_polars(sym, "1d", period)
            if df is not None and len(df) > 10:
                returns = df["close"].pct_change().drop_nulls()
                frames[sym] = returns.to_list()

        if len(frames) < 2:
            return {"error": "Zu wenig Symbole mit Daten"}

        min_len = min(len(v) for v in frames.values())
        data = {k: v[-min_len:] for k, v in frames.items()}
        matrix_df = pl.DataFrame(data)

        corr = {}
        syms = list(data.keys())
        for i, s1 in enumerate(syms):
            corr[s1] = {}
            for s2 in syms:
                c = matrix_df[s1].pearson_corr(matrix_df[s2])
                corr[s1][s2] = round(float(c), 4)

        return {
            "symbols": syms,
            "correlation": corr,
            "period": period,
            "engine": "polars",
        }

    except ImportError:
        return {"error": "polars nicht installiert"}
    except Exception as e:
        logger.error(f"[fast-analytics] Korrelation Fehler: {e}")
        return {"error": str(e)[:100]}
