"""
Backtest Engine — läuft nachts 02:00 UTC (+ manuell triggerbar).

Philosophie: Schlechte Live-Performance = Wissenslücke, kein Verbot.
Märkte die live verlieren bekommen die GRÖSSTE Parameter-Matrix
(Diagnose-Modus), um die Ursache zu finden — nicht weniger Analyse.

Ablauf:
  1. Live-Stats aus Redis lesen → Verlierer-Märkte identifizieren
  2. OHLCV-Daten von divine-warmth holen (1h, 3 Monate)
  3. Pro Markt × Strategie × Parameter-Set: vectorbt-Backtest
     - Normale Märkte:   Basis-Parameter (3 Strategien)
     - Diagnose-Märkte:  volle Parameter-Matrix (bis ~15 Varianten)
  4. Ergebnisse → PG BacktestRun (bestehende Tabelle, nur INSERTs)
                → Redis analysis:backtests (Zusammenfassung + Diagnose)
"""

import time
from datetime import datetime, timezone

import httpx
import numpy as np
import pandas as pd
from loguru import logger

from core.config import settings
from services.storage import pg_execute, redis_get_json, redis_set_json

REDIS_KEY_BACKTESTS = "analysis:backtests"
REDIS_KEY_TRADE_STATS = "analysis:trade_stats"
TTL = 26 * 60 * 60

# Gleiche Watchlist wie der Orchestrator (destinate)
WATCHLIST = [
    "NAS100", "SPX500", "UK100", "GER40", "DJ30", "JPN225",
    "XAUUSD", "USOIL", "UKOIL", "XAGUSD", "NATGAS",
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD",
    "EURGBP", "GBPJPY", "EURJPY",
    "BTCUSD", "ETHUSD",
]

# ── Strategien (regelbasiert, entsprechen den Trading-Styles) ─────────────────
# Basis-Parameter für alle Märkte; Diagnose-Märkte testen die volle Matrix.

BASE_PARAMS = {
    "EMA_CROSS":    [{"fast": 12, "slow": 26}],
    "RSI_REVERSION": [{"period": 14, "entry": 30, "exit": 55}],
    "BREAKOUT":     [{"entry_window": 20, "exit_window": 10}],
}

DIAGNOSE_PARAMS = {
    "EMA_CROSS": [
        {"fast": 9, "slow": 21}, {"fast": 12, "slow": 26},
        {"fast": 20, "slow": 50}, {"fast": 8, "slow": 34},
    ],
    "RSI_REVERSION": [
        {"period": 14, "entry": 30, "exit": 55},
        {"period": 14, "entry": 25, "exit": 60},
        {"period": 7, "entry": 20, "exit": 50},
    ],
    "BREAKOUT": [
        {"entry_window": 20, "exit_window": 10},
        {"entry_window": 55, "exit_window": 20},
        {"entry_window": 10, "exit_window": 5},
    ],
}

SL_TP_VARIANTS = [
    {"sl": 0.01, "tp": 0.02},   # eng (Daytrading-artig)
    {"sl": 0.02, "tp": 0.04},   # mittel
    {"sl": 0.03, "tp": 0.06},   # weit (Swing-artig)
]


def _fetch_ohlcv(symbol: str) -> pd.DataFrame | None:
    """1h-Kerzen, 3 Monate von divine-warmth. None bei Fehler."""
    if not settings.PYTHON_BACKEND_URL:
        return None
    try:
        resp = httpx.get(
            f"{settings.PYTHON_BACKEND_URL}/api/v1/market/ohlcv/{symbol}",
            params={"interval": "1h", "period": "3mo"},
            timeout=30,
        )
        if resp.status_code != 200:
            _log_error(f"OHLCV {symbol}: HTTP {resp.status_code} — {resp.text[:100]}")
            return None
        candles = resp.json().get("candles", [])
        if len(candles) < 200:
            _log_error(f"OHLCV {symbol}: nur {len(candles)} Kerzen — übersprungen")
            return None
        df = pd.DataFrame(candles)
        # erwartete Keys: time/timestamp + open high low close
        time_col = "time" if "time" in df.columns else ("timestamp" if "timestamp" in df.columns else None)
        if time_col:
            df.index = pd.to_datetime(df[time_col])
        for col in ("open", "high", "low", "close"):
            if col not in df.columns:
                _log_error(f"OHLCV {symbol}: Spalte '{col}' fehlt — Keys: {list(df.columns)[:8]}")
                return None
            df[col] = pd.to_numeric(df[col], errors="coerce")
        return df.dropna(subset=["close"])
    except Exception as e:
        _log_error(f"OHLCV {symbol}: {type(e).__name__}: {e}")
        return None


def _signals(close: pd.Series, strategy: str, p: dict) -> tuple[pd.Series, pd.Series]:
    """Entry/Exit-Signale (long) für eine Strategie."""
    if strategy == "EMA_CROSS":
        fast = close.ewm(span=p["fast"], adjust=False).mean()
        slow = close.ewm(span=p["slow"], adjust=False).mean()
        entries = (fast > slow) & (fast.shift(1) <= slow.shift(1))
        exits = (fast < slow) & (fast.shift(1) >= slow.shift(1))
    elif strategy == "RSI_REVERSION":
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(p["period"]).mean()
        loss = (-delta.clip(upper=0)).rolling(p["period"]).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - 100 / (1 + rs)
        entries = (rsi < p["entry"]) & (rsi.shift(1) >= p["entry"])
        exits = (rsi > p["exit"]) & (rsi.shift(1) <= p["exit"])
    elif strategy == "BREAKOUT":
        upper = close.rolling(p["entry_window"]).max().shift(1)
        lower = close.rolling(p["exit_window"]).min().shift(1)
        entries = close > upper
        exits = close < lower
    else:
        raise ValueError(f"Unbekannte Strategie: {strategy}")
    return entries.fillna(False), exits.fillna(False)


# Fehler-Sammlung für Fern-Diagnose (landet im Redis-Summary)
_ERRORS: list[str] = []


def _log_error(msg: str) -> None:
    logger.warning(f"[backtest] {msg}")
    if len(_ERRORS) < 25:
        _ERRORS.append(msg)


def _run_single(close: pd.Series, strategy: str, params: dict, sl: float, tp: float) -> dict | None:
    """Ein Backtest mit vectorbt. None bei Fehler."""
    try:
        import vectorbt as vbt
        entries, exits = _signals(close, strategy, params)
        if entries.sum() < 3:
            _log_error(f"{strategy} {params}: nur {int(entries.sum())} Signale — übersprungen")
            return None  # zu wenig Signale — nicht aussagekräftig
        pf = vbt.Portfolio.from_signals(
            close, entries, exits,
            sl_stop=sl, tp_stop=tp,
            fees=0.0002, freq="1h", init_cash=10_000,
        )
        pnl = pf.trades.pnl.values
        n = len(pnl)
        if n < 3:
            return None
        wins = int((pnl > 0).sum())
        gross_win = float(pnl[pnl > 0].sum())
        gross_loss = float(abs(pnl[pnl < 0].sum()))

        def safe(fn, default=0.0):
            try:
                v = float(fn())
                return v if np.isfinite(v) else default
            except Exception:
                return default

        return {
            "winRate": round(wins / n * 100, 1),
            "profitFactor": round(gross_win / gross_loss, 2) if gross_loss > 0 else 99.0,
            "totalReturn": round(safe(pf.total_return) * 100, 2),
            "maxDrawdown": round(abs(safe(pf.max_drawdown)) * 100, 2),
            "sharpe": round(safe(pf.sharpe_ratio), 2),
            "trades": n,
            "params": params, "sl": sl, "tp": tp,
        }
    except Exception as e:
        _log_error(f"{strategy} {params}: {type(e).__name__}: {e}")
        return None


def _find_diagnose_symbols() -> list[str]:
    """Verlierer-Märkte aus den Live-Stats: WinRate < 40% oder PnL < 0."""
    stats = redis_get_json(REDIS_KEY_TRADE_STATS)
    if not stats:
        return []
    diagnose = []
    by_market = (stats.get("last30d") or {}).get("byMarket") or {}
    for symbol, e in by_market.items():
        if symbol not in WATCHLIST:
            continue
        wr = e.get("winRate")
        if (e.get("pnl", 0) < 0) or (wr is not None and wr < 40):
            diagnose.append(symbol)
    return diagnose


def run_backtests() -> None:
    """Wrapper mit Fern-Diagnose: Fortschritt + Fehler landen in Redis."""
    try:
        _run_backtests_inner()
    except Exception as e:
        import traceback
        logger.error(f"[backtest] ABGESTÜRZT: {e}\n{traceback.format_exc()}")
        redis_set_json(REDIS_KEY_BACKTESTS, {
            "status": "error",
            "error": str(e),
            "trace": traceback.format_exc()[-1500:],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)


def _run_backtests_inner() -> None:
    started = time.time()
    _ERRORS.clear()
    logger.info("[backtest] Lauf gestartet")

    diagnose_symbols = _find_diagnose_symbols()
    logger.info(f"[backtest] Diagnose-Modus (Verlierer, volle Matrix): {diagnose_symbols or 'keine'}")

    results: dict[str, list[dict]] = {}
    for idx, symbol in enumerate(WATCHLIST):
        # Fortschritt nach Redis — remote sichtbar unter /api/v1/backtests
        redis_set_json(REDIS_KEY_BACKTESTS, {
            "status": "running",
            "progress": f"{idx}/{len(WATCHLIST)}",
            "currentSymbol": symbol,
            "elapsedSec": round(time.time() - started),
            "partialBest": {s: r[0]["strategy"] for s, r in results.items()},
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)
        df = _fetch_ohlcv(symbol)
        if df is None:
            continue
        close = df["close"]

        is_diagnose = symbol in diagnose_symbols
        param_sets = DIAGNOSE_PARAMS if is_diagnose else BASE_PARAMS
        sl_tp_list = SL_TP_VARIANTS if is_diagnose else SL_TP_VARIANTS[:1]

        symbol_results = []
        for strategy, param_list in param_sets.items():
            for params in param_list:
                for sltp in sl_tp_list:
                    r = _run_single(close, strategy, params, sltp["sl"], sltp["tp"])
                    if r is None:
                        continue
                    r["strategy"] = strategy
                    r["diagnoseMode"] = is_diagnose
                    symbol_results.append(r)
                    # Bestehende BacktestRun-Tabelle befüllen (nur INSERT)
                    pg_execute(
                        '''INSERT INTO "BacktestRun"
                           (symbol, interval, period, strategy, "winRate", "profitFactor",
                            "totalReturn", "maxDrawdown", "sharpeRatio", "totalTrades")
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                        (symbol, "1h", "3mo",
                         f"{strategy} {r['params']} SL{r['sl']}/TP{r['tp']}",
                         r["winRate"], r["profitFactor"], r["totalReturn"],
                         r["maxDrawdown"], r["sharpe"], r["trades"]),
                    )

        if symbol_results:
            symbol_results.sort(key=lambda x: x["profitFactor"], reverse=True)
            results[symbol] = symbol_results[:10]  # Top 10 pro Symbol
            best = symbol_results[0]
            logger.info(
                f"[backtest] {symbol}{' [DIAGNOSE]' if is_diagnose else ''}: "
                f"{len(symbol_results)} Tests, best: {best['strategy']} "
                f"PF={best['profitFactor']} WR={best['winRate']}%"
            )
        time.sleep(1)  # divine-warmth nicht überlasten

    # Zusammenfassung + Live-vs-Backtest-Vergleich für den AI Manager (Phase 4)
    summary = {
        "status": "done",
        "errors": _ERRORS[:25],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "durationSec": round(time.time() - started),
        "diagnoseSymbols": diagnose_symbols,
        "bestPerSymbol": {
            s: {k: r[0][k] for k in ("strategy", "params", "sl", "tp", "winRate",
                                     "profitFactor", "totalReturn", "trades")}
            for s, r in results.items()
        },
        "fullResults": results,
    }
    ok = redis_set_json(REDIS_KEY_BACKTESTS, summary, TTL)
    logger.info(
        f"[backtest] fertig — {len(results)} Symbole in "
        f"{summary['durationSec']}s, Redis={'ok' if ok else 'FEHLER'}"
    )
