"""
Backtesting Extended — G2E
vectorbt: schnelles Backtesting
quantstats: Performance Reports (Sharpe, Drawdown, Win Rate)
"""

import logging
import numpy as np
import pandas as pd
from typing import Optional
from services.market_data import get_ohlcv

logger = logging.getLogger(__name__)

def _load_df(symbol: str, interval: str = "1d", period: str = "1y") -> Optional[pd.DataFrame]:
    candles = get_ohlcv(symbol, interval, period)
    if not candles or len(candles) < 30:
        return None
    df = pd.DataFrame(candles)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna(subset=["close"])

def run_ema_crossover_backtest(symbol: str, fast: int = 20, slow: int = 50) -> dict:
    """
    EMA Crossover Strategie Backtest via vectorbt (professionell).
    Fast EMA kreuzt über Slow EMA → BUY, darunter → SELL.
    """
    try:
        import vectorbt as vbt

        df = _load_df(symbol, "1d", "2y")
        if df is None or len(df) < slow + 10:
            return {"error": "Zu wenig Daten", "symbol": symbol}

        close = df["close"]
        fast_ema = close.ewm(span=fast, adjust=False).mean()
        slow_ema = close.ewm(span=slow, adjust=False).mean()

        entries = (fast_ema > slow_ema) & (fast_ema.shift(1) <= slow_ema.shift(1))
        exits   = (fast_ema < slow_ema) & (fast_ema.shift(1) >= slow_ema.shift(1))

        pf = vbt.Portfolio.from_signals(close, entries, exits, init_cash=10000, fees=0.001)
        stats = pf.stats()

        return {
            "symbol":       symbol,
            "strategy":     f"EMA({fast},{slow}) Crossover",
            "total_return": round(float(stats.get("Total Return [%]", 0)), 2),
            "sharpe_ratio": round(float(stats.get("Sharpe Ratio", 0) or 0), 3),
            "max_drawdown": round(float(stats.get("Max Drawdown [%]", 0)), 2),
            "win_rate":     round(float(stats.get("Win Rate [%]", 0)), 2),
            "total_trades": int(stats.get("Total Trades", 0)),
            "engine":       "vectorbt",
            "period":       "2y daily",
        }
    except ImportError:
        logger.warning("[backtest] vectorbt nicht verfügbar, nutze pandas Fallback")
        return _ema_crossover_pandas(symbol, fast, slow)
    except Exception as e:
        logger.error(f"[backtest] vectorbt Fehler {symbol}: {e}")
        return _ema_crossover_pandas(symbol, fast, slow)


def _ema_crossover_pandas(symbol: str, fast: int, slow: int) -> dict:
    """Pandas Fallback wenn vectorbt nicht verfügbar."""
    try:
        df = _load_df(symbol, "1d", "2y")
        if df is None or len(df) < slow + 10:
            return {"error": "Zu wenig Daten", "symbol": symbol}

        close = df["close"]
        fast_ema = close.ewm(span=fast, adjust=False).mean()
        slow_ema = close.ewm(span=slow, adjust=False).mean()
        entries = (fast_ema > slow_ema) & (fast_ema.shift(1) <= slow_ema.shift(1))
        exits   = (fast_ema < slow_ema) & (fast_ema.shift(1) >= slow_ema.shift(1))

        cash, position, entry_price = 10000.0, 0.0, 0.0
        trades, wins = 0, 0
        equity = [cash]

        for i in range(len(close)):
            price = float(close.iloc[i])
            if entries.iloc[i] and position == 0:
                position = (cash * 0.999) / price
                entry_price = price
                cash = 0.0
            elif exits.iloc[i] and position > 0:
                cash = position * price * 0.999
                trades += 1
                if price > entry_price:
                    wins += 1
                position = 0.0
            equity.append(cash + position * price)

        final = cash + position * float(close.iloc[-1])
        eq = np.array(equity)
        peak = np.maximum.accumulate(eq)
        dd = (eq - peak) / np.where(peak > 0, peak, 1)

        return {
            "symbol":       symbol,
            "strategy":     f"EMA({fast},{slow}) Crossover",
            "total_return": round((final / 10000 - 1) * 100, 2),
            "max_drawdown": round(float(dd.min()) * 100, 2),
            "win_rate":     round(wins / trades * 100, 2) if trades > 0 else 0,
            "total_trades": trades,
            "final_equity": round(final, 2),
            "engine":       "pandas-fallback",
            "period":       "2y daily",
        }
    except Exception as e:
        logger.error(f"[backtest] pandas Fehler {symbol}: {e}")
        return {"error": str(e)[:100], "symbol": symbol}

def get_performance_report(symbol: str) -> dict:
    """
    QuantStats Performance Report für ein Symbol.
    Sharpe, Sortino, Calmar, Max Drawdown, Win Rate.
    """
    try:
        import quantstats as qs

        df = _load_df(symbol, "1d", "1y")
        if df is None or len(df) < 30:
            return {"error": "Zu wenig Daten", "symbol": symbol}

        returns = df["close"].pct_change().dropna()

        metrics = {
            "symbol":         symbol,
            "sharpe":         round(float(qs.stats.sharpe(returns) or 0), 3),
            "sortino":        round(float(qs.stats.sortino(returns) or 0), 3),
            "max_drawdown":   round(float(qs.stats.max_drawdown(returns) or 0) * 100, 2),
            "cagr":           round(float(qs.stats.cagr(returns) or 0) * 100, 2),
            "volatility":     round(float(qs.stats.volatility(returns) or 0) * 100, 2),
            "win_rate":       round(float(qs.stats.win_rate(returns) or 0) * 100, 2),
            "avg_return":     round(float(returns.mean()) * 100, 4),
            "period":         "1y daily",
        }
        return metrics
    except ImportError:
        return {"error": "quantstats nicht installiert", "symbol": symbol}
    except Exception as e:
        logger.error(f"[backtest] quantstats Fehler {symbol}: {e}")
        return {"error": str(e)[:100], "symbol": symbol}
