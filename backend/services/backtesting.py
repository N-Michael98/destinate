import pandas as pd
import numpy as np
from services.market_data import get_ohlcv

# ── Indikator-Helfer ──────────────────────────────────────────────────────────

def _calc_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _calc_macd(close: pd.Series, fast=12, slow=26, signal=9):
    ema_fast   = close.ewm(span=fast, adjust=False).mean()
    ema_slow   = close.ewm(span=slow, adjust=False).mean()
    macd_line  = ema_fast - ema_slow
    signal_line= macd_line.ewm(span=signal, adjust=False).mean()
    hist       = macd_line - signal_line
    return macd_line, signal_line, hist

def _calc_bb(close: pd.Series, period=20, std_dev=2.0):
    sma   = close.rolling(period).mean()
    std   = close.rolling(period).std()
    upper = sma + std_dev * std
    lower = sma - std_dev * std
    return upper, sma, lower

def _calc_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    hl   = df["high"] - df["low"]
    hc   = (df["high"] - df["close"].shift()).abs()
    lc   = (df["low"]  - df["close"].shift()).abs()
    tr   = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.rolling(period).mean()

# ── Signal-Funktionen (geben "LONG" / "SHORT" / None zurück) ──────────────────

def _signal_rsi(df: pd.DataFrame, i: int, oversold=30, overbought=70):
    rsi = df["rsi"].iloc[i]
    if rsi <= oversold:  return "LONG"
    if rsi >= overbought: return "SHORT"
    return None

def _signal_macd(df: pd.DataFrame, i: int):
    if i < 1: return None
    hist_now  = df["macd_hist"].iloc[i]
    hist_prev = df["macd_hist"].iloc[i - 1]
    if hist_prev <= 0 and hist_now > 0: return "LONG"
    if hist_prev >= 0 and hist_now < 0: return "SHORT"
    return None

def _signal_ema(df: pd.DataFrame, i: int):
    if i < 1: return None
    e20, e50 = df["ema20"].iloc[i], df["ema50"].iloc[i]
    e20p, e50p = df["ema20"].iloc[i-1], df["ema50"].iloc[i-1]
    if e20p <= e50p and e20 > e50: return "LONG"
    if e20p >= e50p and e20 < e50: return "SHORT"
    return None

def _signal_bb(df: pd.DataFrame, i: int):
    price = df["close"].iloc[i]
    if price <= df["bb_lower"].iloc[i]: return "LONG"
    if price >= df["bb_upper"].iloc[i]: return "SHORT"
    return None

def _signal_multi(df: pd.DataFrame, i: int):
    """Multi-Signal: mindestens 2 von 3 Indikatoren stimmen überein."""
    votes = [_signal_rsi(df, i), _signal_macd(df, i), _signal_ema(df, i)]
    longs  = votes.count("LONG")
    shorts = votes.count("SHORT")
    if longs  >= 2: return "LONG"
    if shorts >= 2: return "SHORT"
    return None

STRATEGY_META = {
    "rsi":        {"name": "RSI Mean Reversion",    "indicators": ["RSI(14)"],                              "signal_fn": _signal_rsi},
    "macd":       {"name": "MACD Crossover",         "indicators": ["MACD(12,26,9)", "Signal"],             "signal_fn": _signal_macd},
    "ema":        {"name": "EMA Crossover",          "indicators": ["EMA(20)", "EMA(50)"],                  "signal_fn": _signal_ema},
    "bb":         {"name": "Bollinger Band Reversion","indicators": ["BB(20,2)", "SMA(20)"],                "signal_fn": _signal_bb},
    "multi":      {"name": "Multi-Signal Consensus", "indicators": ["RSI(14)", "MACD(12,26)", "EMA(20/50)"],"signal_fn": _signal_multi},
}

# ── Haupt-Backtest ─────────────────────────────────────────────────────────────

def run_backtest(
    symbol: str,
    interval: str = "1h",
    period: str = "6mo",
    strategy: str = "rsi",
    sl_pct: float = 0.01,
    tp_pct: float = 0.02,
    initial_balance: float = 10000.0,
    # RSI-Parameter (rückwärtskompatibel)
    rsi_oversold: float = 30.0,
    rsi_overbought: float = 70.0,
) -> dict:
    candles = get_ohlcv(symbol, interval, period)
    if not candles or len(candles) < 60:
        return {"error": "Not enough data for backtest"}

    df = pd.DataFrame(candles)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df.set_index("timestamp", inplace=True)

    # Alle Indikatoren vorberechnen
    df["rsi"]      = _calc_rsi(df["close"])
    df["macd_line"], df["macd_signal"], df["macd_hist"] = _calc_macd(df["close"])
    df["ema20"]    = df["close"].ewm(span=20, adjust=False).mean()
    df["ema50"]    = df["close"].ewm(span=50, adjust=False).mean()
    df["ema200"]   = df["close"].ewm(span=200, adjust=False).mean()
    df["bb_upper"], df["bb_mid"], df["bb_lower"] = _calc_bb(df["close"])
    df["atr"]      = _calc_atr(df)

    meta = STRATEGY_META.get(strategy, STRATEGY_META["rsi"])
    signal_fn = meta["signal_fn"]

    # RSI-Oversold/Overbought per closure anpassen
    def get_signal(i):
        if strategy == "rsi":
            return _signal_rsi(df, i, rsi_oversold, rsi_overbought)
        return signal_fn(df, i)

    # ATR-basierte SL/TP wenn ATR verfügbar
    def get_sl_tp(entry: float, direction: str, i: int):
        atr = df["atr"].iloc[i]
        if pd.notna(atr) and atr > 0:
            sl_dist = atr * 1.5
            tp_dist = atr * 3.0
        else:
            sl_dist = entry * sl_pct
            tp_dist = entry * tp_pct
        if direction == "LONG":
            return entry - sl_dist, entry + tp_dist
        return entry + sl_dist, entry - tp_dist

    balance    = initial_balance
    trades     = []
    in_trade   = False
    entry_price = 0.0
    direction  = ""
    entry_idx  = 0
    sl = tp = 0.0

    start = max(55, 0)
    for i in range(start, len(df)):
        row = df.iloc[i]

        if not in_trade:
            sig = get_signal(i)
            if sig in ("LONG", "SHORT"):
                in_trade    = True
                direction   = sig
                entry_price = row["close"]
                entry_idx   = i
                sl, tp      = get_sl_tp(entry_price, direction, i)
        else:
            hit_sl = row["low"] <= sl if direction == "LONG" else row["high"] >= sl
            hit_tp = row["high"] >= tp if direction == "LONG" else row["low"] <= tp

            if hit_tp or hit_sl:
                exit_price = tp if hit_tp else sl
                if direction == "LONG":
                    pnl_pct = (exit_price - entry_price) / entry_price
                else:
                    pnl_pct = (entry_price - exit_price) / entry_price

                risk_dist = abs(entry_price - sl)
                risk_pct  = risk_dist / entry_price if entry_price > 0 else sl_pct
                pnl_usd   = balance * 0.01 * (pnl_pct / risk_pct) if risk_pct > 0 else 0
                balance  += pnl_usd

                # Indikator-Snapshot zum Trade
                ind_snapshot = {}
                if "rsi" in df.columns:
                    ind_snapshot["rsi"] = round(float(df["rsi"].iloc[entry_idx]), 1) if pd.notna(df["rsi"].iloc[entry_idx]) else None
                if "macd_hist" in df.columns:
                    ind_snapshot["macd_hist"] = round(float(df["macd_hist"].iloc[entry_idx]), 6) if pd.notna(df["macd_hist"].iloc[entry_idx]) else None
                if "ema20" in df.columns and "ema50" in df.columns:
                    e20 = df["ema20"].iloc[entry_idx]
                    e50 = df["ema50"].iloc[entry_idx]
                    ind_snapshot["ema20_vs_ema50"] = "above" if e20 > e50 else "below"

                trades.append({
                    "entry_time":  df.index[entry_idx].isoformat(),
                    "exit_time":   df.index[i].isoformat(),
                    "direction":   direction,
                    "entry_price": round(float(entry_price), 5),
                    "exit_price":  round(float(exit_price), 5),
                    "stop_loss":   round(float(sl), 5),
                    "take_profit": round(float(tp), 5),
                    "result":      "WIN" if hit_tp else "LOSS",
                    "pnl_usd":     round(float(pnl_usd), 2),
                    "balance":     round(float(balance), 2),
                    "indicators":  ind_snapshot,
                })
                in_trade = False

    if not trades:
        return {
            "error":    "No trades generated in this period",
            "symbol":   symbol.upper(),
            "strategy": strategy,
            "strategy_name": meta["name"],
            "indicators_used": meta["indicators"],
            "trades":   [],
        }

    wins      = [t for t in trades if t["result"] == "WIN"]
    losses    = [t for t in trades if t["result"] == "LOSS"]
    win_rate  = round(len(wins) / len(trades) * 100, 1)
    total_pnl = round(balance - initial_balance, 2)
    gross_win = sum(t["pnl_usd"] for t in wins)
    gross_loss= abs(sum(t["pnl_usd"] for t in losses))
    profit_factor = round(gross_win / gross_loss, 2) if gross_loss > 0 else 999.0

    # Max Drawdown
    peak = initial_balance
    max_dd = 0.0
    bal = initial_balance
    for t in trades:
        bal += t["pnl_usd"]
        if bal > peak: peak = bal
        dd = (peak - bal) / peak * 100
        if dd > max_dd: max_dd = dd

    # Sharpe-ähnliche Kennzahl (vereinfacht)
    pnls = [t["pnl_usd"] for t in trades]
    avg_pnl = np.mean(pnls)
    std_pnl = np.std(pnls)
    sharpe  = round(avg_pnl / std_pnl, 2) if std_pnl > 0 else 0.0

    return {
        "symbol":            symbol.upper(),
        "interval":          interval,
        "period":            period,
        "strategy":          strategy,
        "strategy_name":     meta["name"],
        "indicators_used":   meta["indicators"],
        "total_trades":      len(trades),
        "wins":              len(wins),
        "losses":            len(losses),
        "win_rate":          win_rate,
        "profit_factor":     profit_factor,
        "sharpe_ratio":      sharpe,
        "initial_balance":   initial_balance,
        "final_balance":     round(balance, 2),
        "total_pnl":         total_pnl,
        "total_return_pct":  round(total_pnl / initial_balance * 100, 2),
        "max_drawdown_pct":  round(max_dd, 2),
        "trades":            trades[-20:],
    }


def run_all_strategies(
    symbol: str,
    interval: str = "1h",
    period: str = "3mo",
    initial_balance: float = 10000.0,
) -> list:
    """Alle Strategien auf einmal backtesten — für Strategy Evolution."""
    results = []
    for strat in STRATEGY_META:
        r = run_backtest(symbol, interval, period, strategy=strat, initial_balance=initial_balance)
        results.append(r)
    return results
