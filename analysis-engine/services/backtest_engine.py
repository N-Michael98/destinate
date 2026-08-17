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
# 03.08. von 22 auf 30 erweitert, parallel zum Orchestrator. Diese Märkte wurden
# live schon immer gehandelt, sobald Capital.com sie lieferte — nur konnte er das
# wegen falscher Epic-Namen nie. Sie müssen hier mitlaufen, sonst würden Märkte
# gehandelt, für die es keinerlei Backtest-Beleg gibt.
WATCHLIST = [
    "NAS100", "SPX500", "UK100", "GER40", "DJ30", "JPN225",
    "XAUUSD", "USOIL", "UKOIL", "XAGUSD", "NATGAS",
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
    "EURGBP", "GBPJPY", "EURJPY",
    "BTCUSD", "ETHUSD", "LTCUSD", "XRPUSD", "ADAUSD", "SOLUSD", "DOTUSD",
    "LNKUSD", "BNBUSD",
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
            headers={"X-Backend-Key": settings.BACKEND_API_KEY} if settings.BACKEND_API_KEY else {},
            # 45s (27.07. erhöht, Fund-#6-Folgefund #9): Backend-Route nutzt seit
            # heute @api_retry() (bis 3 Versuche, ~3s Backoff) — 30s war knapper
            # geworden als vor dem Retry-Fix.
            timeout=45,
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


def _signals(close: pd.Series, strategy: str, p: dict) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    """Long- UND Short-Signale für eine Strategie.

    Bis 30.07. lieferte diese Funktion ausschliesslich Long-Signale — dadurch
    konnten der nächtliche Backtest, die Walk-Forward-Prüfung und alle darauf
    aufbauenden Empfehlungen NIE bewerten, ob ein Short-Setup funktioniert
    hätte. Bei fallenden Märkten zeigte die Auswertung nur "Long lief schlecht"
    statt "Short hätte verdient". Das Live-Trading kann seit dem Prompt-Fix
    short gehen — die Validierung war dafür blind.

    Die Short-Signale sind jeweils das Spiegelbild der Long-Logik:
      EMA_CROSS      Death Cross öffnet Short, Golden Cross schliesst ihn
      RSI_REVERSION  überkauft (100-entry) öffnet Short, Rückkehr (100-exit) schliesst
      BREAKOUT       Bruch nach unten öffnet Short, Ausbruch nach oben schliesst

    Rückgabe: (entries, exits, short_entries, short_exits)
    """
    if strategy == "EMA_CROSS":
        fast = close.ewm(span=p["fast"], adjust=False).mean()
        slow = close.ewm(span=p["slow"], adjust=False).mean()
        golden = (fast > slow) & (fast.shift(1) <= slow.shift(1))
        death = (fast < slow) & (fast.shift(1) >= slow.shift(1))
        entries, exits = golden, death
        short_entries, short_exits = death, golden
    elif strategy == "RSI_REVERSION":
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(p["period"]).mean()
        loss = (-delta.clip(upper=0)).rolling(p["period"]).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - 100 / (1 + rs)
        entries = (rsi < p["entry"]) & (rsi.shift(1) >= p["entry"])
        exits = (rsi > p["exit"]) & (rsi.shift(1) <= p["exit"])
        # Spiegel: entry 30 -> Short bei 70, exit 55 -> Deckung bei 45
        s_entry_lvl = 100 - p["entry"]
        s_exit_lvl = 100 - p["exit"]
        short_entries = (rsi > s_entry_lvl) & (rsi.shift(1) <= s_entry_lvl)
        short_exits = (rsi < s_exit_lvl) & (rsi.shift(1) >= s_exit_lvl)
    elif strategy == "BREAKOUT":
        upper = close.rolling(p["entry_window"]).max().shift(1)
        lower = close.rolling(p["exit_window"]).min().shift(1)
        entries = close > upper
        exits = close < lower
        short_entries = close < lower
        short_exits = close > upper
    else:
        raise ValueError(f"Unbekannte Strategie: {strategy}")
    return (
        entries.fillna(False), exits.fillna(False),
        short_entries.fillna(False), short_exits.fillna(False),
    )


# Fehler-Sammlung für Fern-Diagnose (landet im Redis-Summary)
_ERRORS: list[str] = []


def _log_error(msg: str) -> None:
    logger.warning(f"[backtest] {msg}")
    if len(_ERRORS) < 25:
        _ERRORS.append(msg)


def _vorlauf(strategy: str, params: dict) -> int:
    """Wie viele Balken braucht der Indikator, bevor er verlaesslich ist.

    Gebraucht fuer den Walk-Forward: dessen Test-Abschnitt begann bisher KALT,
    also mit einem Indikator, der bei null anfaengt. NACHGEMESSEN (09.08.,
    3000 Balken, Testfenster 500):

      EMA_CROSS slow=21   kalt 16 Signale, warm 12  -> 4 ERFUNDENE (+33 %)
      EMA_CROSS slow=50   kalt 12, warm 10          -> 2 erfundene
      BREAKOUT  ew=55     kalt 100, warm 106        -> 6 FEHLENDE
      RSI       p=14      kalt 31, warm 32          -> 1 fehlendes

    Der gleitende Durchschnitt laeuft aus dem Stand los und kreuzt sich dabei
    scheinbar — er ERFINDET Signale. Die rollenden Fenster liefern anfangs
    nichts und VERLIEREN welche. Beides verzerrt genau die Zahl, auf der das
    Urteil "robust" beruht.

    KEINE Informationsdurchsickerung: Vorlauf benutzt ausschliesslich
    VERGANGENE Balken relativ zum Testfenster — genau das, was im Livebetrieb
    auch vorliegt. Leakage waere Zukunftswissen, das hier nicht entsteht.
    """
    if strategy == "EMA_CROSS":
        return int(params.get("slow", 26))
    if strategy == "RSI_REVERSION":
        return int(params.get("period", 14))
    if strategy == "BREAKOUT":
        return max(int(params.get("entry_window", 20)), int(params.get("exit_window", 10)))
    return 0


# Faktor 3, gemessen und nicht gewaehlt: der groesste tatsaechliche Bedarf lag
# bei 105 Balken fuer EMA slow=50, also dem 2.1-fachen des Parameters. Faktor 3
# deckt das mit Reserve. Gegengeprueft ueber 15 Kursverlaeufe (5 Startwerte x
# 3 Volatilitaeten, je 10 Parametersaetze): 150 Vergleiche, 0 Abweichungen zum
# Ergebnis mit vollem Vorlauf.
VORLAUF_FAKTOR = 3


def _run_single(close: pd.Series, strategy: str, params: dict, sl: float, tp: float,
                ab_index: int = 0) -> dict | None:
    """Ein Backtest mit vectorbt. None bei Fehler.

    ab_index (09.08.): Balken VOR diesem Index dienen nur als Vorlauf fuer die
    Indikatoren — dort wird nicht eingestiegen. Standard 0 = unveraendertes
    bisheriges Verhalten, damit der naechtliche Backtest gleich bleibt.
    """
    try:
        import vectorbt as vbt
        entries, exits, short_entries, short_exits = _signals(close, strategy, params)
        if ab_index > 0:
            # Nur Einstiege sperren. Ausstiege koennen ohne Position ohnehin
            # nichts ausloesen, und sie zu sperren wuerde eine im Testfenster
            # eroeffnete Position am Schliessen hindern.
            vor_dem_fenster = np.arange(len(close)) < ab_index
            entries = entries.copy()
            short_entries = short_entries.copy()
            entries[vor_dem_fenster] = False
            short_entries[vor_dem_fenster] = False
        # Long UND Short zusammen zählen (30.07.): vorher wurde ein Symbol
        # verworfen, wenn es zu wenig LONG-Signale hatte — auch wenn es reichlich
        # Short-Gelegenheiten gab.
        total_entries = int(entries.sum()) + int(short_entries.sum())
        if total_entries < 3:
            _log_error(f"{strategy} {params}: nur {total_entries} Signale (long+short) — übersprungen")
            return None  # zu wenig Signale — nicht aussagekräftig
        pf = vbt.Portfolio.from_signals(
            close, entries, exits,
            short_entries=short_entries, short_exits=short_exits,
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
