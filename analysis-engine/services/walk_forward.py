"""
Walk-Forward-Optimierung (Woche 2, 26.07.) — läuft wöchentlich Samstag 03:00 UTC.

Der nächtliche Backtest (backtest_engine.py) optimiert Parameter auf dem
GESAMTEN 3-Monats-Zeitraum auf einmal (In-Sample) — das Overfitting-Risiko:
die "beste" Kombination könnte nur zufällig zu genau diesen 3 Monaten passen.

Walk-Forward validiert das: Parameter werden auf einem Teil der Daten
optimiert (Train) und auf einem ANDEREN, nie gesehenen Teil getestet (Test).
Nur wenn eine Strategie auch Out-of-Sample profitabel bleibt, gilt sie als
robust statt kurvengefittet.

Anchored Walk-Forward mit 2 Folds:
  Fold A: Train = erste 50% | Test = nächste 25% (ungesehen)
  Fold B: Train = erste 75% | Test = letzte 25% (ungesehen)

Komplett additiv: eigenes Redis-Key, eigener Endpoint, rührt
backtest_engine.py / analysis:backtests nicht an.
"""

import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from loguru import logger

from services.backtest_engine import (
    WATCHLIST, BASE_PARAMS, DIAGNOSE_PARAMS, SL_TP_VARIANTS,
    VORLAUF_FAKTOR, _fetch_ohlcv, _run_single, _find_diagnose_symbols, _vorlauf,
)
from services.storage import redis_get_json, redis_set_json

REDIS_KEY_WALKFORWARD = "analysis:walkforward"
TTL = 8 * 24 * 60 * 60  # 8 Tage — läuft wöchentlich

# Anchored-Fold-Grenzen als Anteil der Gesamtlänge: (train_end, test_end)
FOLDS = [(0.50, 0.75), (0.75, 1.00)]

# Ab diesem Out-of-Sample-Profit-Factor gilt eine Strategie als robust
ROBUST_MIN_PF = 1.2
# Grössere Lücke als das = Overfitting-Verdacht
OVERFIT_GAP_RATIO = 0.5  # out-of-sample < 50% des in-sample PF

# Mindestzahl Trades, damit ein Parametersatz ueberhaupt gewaehlt werden darf
# (09.08.). Vorher gewann der hoechste ProfitFactor — auch wenn er auf zwei
# Trades beruhte. Genau so entsteht Ueberanpassung: bei wenigen Trades ist ein
# hoher Faktor Zufall, kein Nachweis.
#
# Die 10 ist KEINE neue Zahl: recommendations.py verlangt seit dem 30.07.
# MIN_BT_TRADES = 10, bevor ein Backtest-Ergebnis einen Vorschlag begruenden
# darf. Dieselbe Huerde gilt jetzt schon bei der Auswahl.
MIN_TRADES_FUER_AUSWAHL = 10


def _best_on_slice(close: pd.Series, param_sets: dict, sl_tp_list: list) -> dict | None:
    """Testet die Parameter-Matrix auf EINEM Datenausschnitt, gibt die beste
    Kombination nach ProfitFactor zurück (None wenn nichts auswertbar).

    Seit 09.08. mit Mindest-Trade-Zahl: ein Parametersatz mit weniger als
    MIN_TRADES_FUER_AUSWAHL Trades darf nicht gewinnen, egal wie hoch sein
    ProfitFactor ist. Vorher konnte ein Faktor aus zwei Trades die Auswahl
    bestimmen — und genau dieser Wert wurde dann als "in-sample" gemeldet und
    dem Out-of-Sample gegenuebergestellt.

    Faellt kein Satz ueber die Huerde, wird KEINER gewaehlt (None). Das ist
    gewollt: lieber kein Urteil als eines auf drei Trades. Der Fold wird dann
    uebersprungen und im Ergebnis als solcher gezaehlt.
    """
    best = None
    verworfen_wenig_trades = 0
    for strategy, param_list in param_sets.items():
        for params in param_list:
            for sltp in sl_tp_list:
                r = _run_single(close, strategy, params, sltp["sl"], sltp["tp"])
                if r is None:
                    continue
                if r.get("trades", 0) < MIN_TRADES_FUER_AUSWAHL:
                    verworfen_wenig_trades += 1
                    continue
                r["strategy"] = strategy
                if best is None or r["profitFactor"] > best["profitFactor"]:
                    best = r
    if best is None and verworfen_wenig_trades:
        logger.info(
            f"[walk-forward] kein Parametersatz mit >= {MIN_TRADES_FUER_AUSWAHL} Trades "
            f"({verworfen_wenig_trades} verworfen) — Fold nicht auswertbar"
        )
    return best


def _evaluate_walk_forward(symbol: str, df: pd.DataFrame, is_diagnose: bool) -> dict | None:
    """Führt beide Folds für ein Symbol aus. None wenn zu wenig Daten/Signale."""
    close = df["close"]
    n = len(close)
    if n < 200:
        return None

    param_sets = DIAGNOSE_PARAMS if is_diagnose else BASE_PARAMS
    sl_tp_list = SL_TP_VARIANTS if is_diagnose else SL_TP_VARIANTS[:1]

    fold_results = []
    for train_frac, test_frac in FOLDS:
        train_end = int(n * train_frac)
        test_end = int(n * test_frac)
        if train_end < 100 or test_end <= train_end:
            continue
        train_close = close.iloc[:train_end]

        best_in_sample = _best_on_slice(train_close, param_sets, sl_tp_list)
        if best_in_sample is None:
            continue

        # VORLAUF FUER DEN TESTABSCHNITT (09.08.).
        #
        # Bisher begann der Test bei train_end — mit einem Indikator, der dort
        # bei null anfaengt. Nachgemessen verzerrt das in BEIDE Richtungen:
        # der gleitende Durchschnitt erfindet Kreuzungen (EMA slow=21: 16 statt
        # 12 Signale, +33 %), die rollenden Fenster verlieren welche (BREAKOUT
        # ew=55: 100 statt 106). Beides trifft genau die Zahl, aus der das
        # Urteil "robust" entsteht.
        #
        # Jetzt bekommt der Testabschnitt Balken davor als Vorlauf, aber
        # EINGESTIEGEN wird erst ab train_end (ab_index). Das ist KEINE
        # Informationsdurchsickerung: benutzt werden nur Balken, die zum
        # jeweiligen Testzeitpunkt bereits in der Vergangenheit lagen — genau
        # wie im Livebetrieb, wo der Indikator warm ist.
        vorlauf = _vorlauf(best_in_sample["strategy"], best_in_sample["params"]) * VORLAUF_FAKTOR
        warm_start = max(0, train_end - vorlauf)
        test_close = close.iloc[warm_start:test_end]
        ab_index = train_end - warm_start

        # Denselben Parametersatz OHNE erneute Optimierung auf den
        # ungesehenen Testabschnitt anwenden — das ist der Kern von WFO.
        out_sample = _run_single(
            test_close, best_in_sample["strategy"], best_in_sample["params"],
            best_in_sample["sl"], best_in_sample["tp"], ab_index=ab_index,
        )

        fold_results.append({
            "trainFrac": train_frac, "testFrac": test_frac,
            # Nachvollziehbar machen, wie viel Vorlauf benutzt wurde
            "vorlaufBalken": ab_index,
            "strategy": best_in_sample["strategy"], "params": best_in_sample["params"],
            "inSampleProfitFactor": best_in_sample["profitFactor"],
            "inSampleWinRate": best_in_sample["winRate"],
            "outSampleProfitFactor": out_sample["profitFactor"] if out_sample else 0.0,
            "outSampleWinRate": out_sample["winRate"] if out_sample else None,
            "outSampleTrades": out_sample["trades"] if out_sample else 0,
        })

    if not fold_results:
        return None

    avg_out_pf = float(np.mean([f["outSampleProfitFactor"] for f in fold_results]))
    avg_in_pf = float(np.mean([f["inSampleProfitFactor"] for f in fold_results]))
    # Wie oft gewinnt dieselbe Strategie über beide Folds? (Stabilitäts-Indikator)
    strategies_chosen = {f["strategy"] for f in fold_results}
    consistent = len(strategies_chosen) == 1

    overfit_warning = avg_in_pf > 0 and (avg_out_pf / avg_in_pf) < OVERFIT_GAP_RATIO
    robust = avg_out_pf >= ROBUST_MIN_PF and not overfit_warning

    return {
        "symbol": symbol,
        "folds": fold_results,
        "avgInSampleProfitFactor": round(avg_in_pf, 2),
        "avgOutSampleProfitFactor": round(avg_out_pf, 2),
        "consistentStrategy": consistent,
        "chosenStrategies": sorted(strategies_chosen),
        "overfitWarning": overfit_warning,
        "robust": robust,
    }


def run_walk_forward() -> None:
    """Wrapper mit Fern-Diagnose (gleiches Muster wie run_backtests)."""
    try:
        _run_walk_forward_inner()
    except Exception as e:
        import traceback
        logger.error(f"[walk-forward] ABGESTÜRZT: {e}\n{traceback.format_exc()}")
        redis_set_json(REDIS_KEY_WALKFORWARD, {
            "status": "error",
            "error": str(e),
            "trace": traceback.format_exc()[-1500:],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)


def _run_walk_forward_inner() -> None:
    started = time.time()
    logger.info("[walk-forward] Lauf gestartet")
    diagnose_symbols = _find_diagnose_symbols()

    results: dict[str, dict] = {}
    for idx, symbol in enumerate(WATCHLIST):
        redis_set_json(REDIS_KEY_WALKFORWARD, {
            "status": "running",
            "progress": f"{idx}/{len(WATCHLIST)}",
            "currentSymbol": symbol,
            "elapsedSec": round(time.time() - started),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)

        df = _fetch_ohlcv(symbol)
        if df is None:
            continue
        r = _evaluate_walk_forward(symbol, df, symbol in diagnose_symbols)
        if r is None:
            continue
        results[symbol] = r
        logger.info(
            f"[walk-forward] {symbol}: inPF={r['avgInSampleProfitFactor']} "
            f"outPF={r['avgOutSampleProfitFactor']} robust={r['robust']}"
            f"{' [OVERFIT-VERDACHT]' if r['overfitWarning'] else ''}"
        )
        time.sleep(1)  # divine-warmth nicht überlasten

    robust_symbols = [s for s, r in results.items() if r["robust"]]
    overfit_symbols = [s for s, r in results.items() if r["overfitWarning"]]

    summary = {
        "status": "done",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "durationSec": round(time.time() - started),
        "robustSymbols": robust_symbols,
        "overfitWarningSymbols": overfit_symbols,
        "results": results,
    }
    ok = redis_set_json(REDIS_KEY_WALKFORWARD, summary, TTL)
    logger.info(
        f"[walk-forward] fertig — {len(results)} Symbole, "
        f"{len(robust_symbols)} robust, {len(overfit_symbols)} Overfit-Verdacht, "
        f"Redis={'ok' if ok else 'FEHLER'}"
    )
