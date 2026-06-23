"""
Advanced Analysis — Phase 3
Ebene 1: Hurst-Exponent     (Mean-Reversion vs Trending)
Ebene 2: GARCH              (Volatilitäts-Prognose)
Ebene 3: XGBoost            (ML Richtungsvorhersage)

Ergänzt market_intelligence.py — wird nicht ersetzt.
"""

import logging
import numpy as np
import pandas as pd
from typing import Optional
from services.market_data import get_ohlcv

logger = logging.getLogger(__name__)

# ── Hilfsfunktion ─────────────────────────────────────────────────────────────

def _load_close(symbol: str, interval: str = "1h", period: str = "30d") -> Optional[np.ndarray]:
    candles = get_ohlcv(symbol, interval, period)
    if not candles or len(candles) < 30:
        return None
    df = pd.DataFrame(candles)
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    closes = df["close"].dropna().values
    return closes if len(closes) >= 30 else None

# ── Ebene 1: Hurst-Exponent ───────────────────────────────────────────────────

def compute_hurst(closes: np.ndarray) -> Optional[float]:
    """
    Hurst-Exponent via R/S Analyse.
    H < 0.45 → Mean-Reversion (Ranging)
    H ~ 0.50 → Random Walk
    H > 0.55 → Trending
    """
    try:
        n = len(closes)
        if n < 20:
            return None
        lags = range(2, min(20, n // 2))
        tau = []
        for lag in lags:
            diffs = np.subtract(closes[lag:], closes[:-lag])
            tau.append(np.sqrt(np.std(diffs)))
        if not tau or all(t == 0 for t in tau):
            return None
        reg = np.polyfit(np.log(list(lags)), np.log(tau), 1)
        return round(float(reg[0]), 3)
    except Exception as e:
        logger.warning(f"[advanced] Hurst Fehler: {e}")
        return None

def hurst_signal(h: Optional[float]) -> dict:
    if h is None:
        return {"hurst": None, "regime": "UNKNOWN", "description": "Nicht berechenbar"}
    if h < 0.45:
        return {"hurst": h, "regime": "MEAN_REVERSION", "description": f"Mean-Reversion (H={h}) — Ranges gut für Scalping"}
    elif h > 0.55:
        return {"hurst": h, "regime": "TRENDING", "description": f"Trending (H={h}) — Trend-Trades bevorzugen"}
    else:
        return {"hurst": h, "regime": "RANDOM", "description": f"Random Walk (H={h}) — Vorsicht, kein klares Muster"}

# ── Ebene 2: GARCH Volatilitäts-Prognose ─────────────────────────────────────

def compute_garch(closes: np.ndarray) -> dict:
    """
    GARCH(1,1) Volatilitätsprognose.
    Gibt prognostizierte Volatilität + Regime zurück.
    """
    try:
        from arch import arch_model
        returns = np.diff(np.log(closes)) * 100
        if len(returns) < 30:
            return {"vol_forecast": None, "vol_regime": "UNKNOWN"}

        model = arch_model(returns, vol="Garch", p=1, q=1, dist="normal", rescale=True)
        result = model.fit(disp="off", show_warning=False)
        forecast = result.forecast(horizon=1)
        vol = float(np.sqrt(forecast.variance.values[-1, 0]))
        vol = round(vol, 4)

        # Historische Volatilität zum Vergleich
        hist_vol = float(np.std(returns[-20:]))

        if vol > hist_vol * 1.3:
            regime = "HIGH_VOL"
            description = f"Volatilität steigt ({vol:.3f}%) — SL vergrössern"
        elif vol < hist_vol * 0.7:
            regime = "LOW_VOL"
            description = f"Volatilität fällt ({vol:.3f}%) — Ausbruch möglich"
        else:
            regime = "NORMAL_VOL"
            description = f"Normale Volatilität ({vol:.3f}%)"

        return {
            "vol_forecast": vol,
            "hist_vol":     round(hist_vol, 4),
            "vol_regime":   regime,
            "description":  description,
        }
    except ImportError:
        logger.warning("[advanced] arch library nicht installiert")
        return {"vol_forecast": None, "vol_regime": "UNKNOWN", "description": "arch nicht installiert"}
    except Exception as e:
        logger.warning(f"[advanced] GARCH Fehler: {e}")
        return {"vol_forecast": None, "vol_regime": "UNKNOWN", "description": str(e)[:60]}

# ── Ebene 3: XGBoost Richtungsvorhersage ─────────────────────────────────────

def _build_features(closes: np.ndarray) -> Optional[pd.DataFrame]:
    """Features für XGBoost aus Preisreihe bauen."""
    if len(closes) < 50:
        return None
    df = pd.DataFrame({"close": closes})
    df["ret1"]  = df["close"].pct_change(1)
    df["ret3"]  = df["close"].pct_change(3)
    df["ret5"]  = df["close"].pct_change(5)
    df["ret10"] = df["close"].pct_change(10)
    df["ma5"]   = df["close"].rolling(5).mean() / df["close"] - 1
    df["ma10"]  = df["close"].rolling(10).mean() / df["close"] - 1
    df["ma20"]  = df["close"].rolling(20).mean() / df["close"] - 1
    df["vol5"]  = df["ret1"].rolling(5).std()
    df["vol10"] = df["ret1"].rolling(10).std()
    df["mom"]   = df["close"] / df["close"].shift(10) - 1
    return df.dropna()

def compute_xgboost(closes: np.ndarray) -> dict:
    """
    Trainiert XGBoost auf historischen Daten und gibt Richtungsprognose zurück.
    Label: 1 = Preis in 3 Kerzen gestiegen, 0 = gefallen
    """
    try:
        from xgboost import XGBClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score

        df = _build_features(closes)
        if df is None or len(df) < 40:
            return {"direction": "UNKNOWN", "probability": None, "accuracy": None}

        feature_cols = ["ret1", "ret3", "ret5", "ret10", "ma5", "ma10", "ma20", "vol5", "vol10", "mom"]
        df["target"] = (df["close"].shift(-3) > df["close"]).astype(int)
        df = df.dropna()

        if len(df) < 30:
            return {"direction": "UNKNOWN", "probability": None, "accuracy": None}

        X = df[feature_cols].values
        y = df["target"].values

        # Letzte Zeile = Prognose für jetzt
        X_pred = X[-1:].copy()
        X_train = X[:-1]
        y_train = y[:-1]

        if len(X_train) < 20:
            return {"direction": "UNKNOWN", "probability": None, "accuracy": None}

        # Train/Test Split für Accuracy
        split = max(10, int(len(X_train) * 0.8))
        X_tr, X_te = X_train[:split], X_train[split:]
        y_tr, y_te = y_train[:split], y_train[split:]

        model = XGBClassifier(
            n_estimators=50,
            max_depth=3,
            learning_rate=0.1,
            eval_metric="logloss",
            verbosity=0,
        )
        model.fit(X_tr, y_tr)

        accuracy = None
        if len(X_te) > 0:
            accuracy = round(float(accuracy_score(y_te, model.predict(X_te))), 3)

        # Prognose
        prob = float(model.predict_proba(X_pred)[0][1])
        direction = "BUY" if prob >= 0.55 else "SELL" if prob <= 0.45 else "NEUTRAL"

        return {
            "direction":   direction,
            "probability": round(prob, 3),
            "accuracy":    accuracy,
            "description": f"ML: {direction} (p={prob:.2f}, acc={accuracy})",
        }

    except ImportError:
        logger.warning("[advanced] xgboost nicht installiert")
        return {"direction": "UNKNOWN", "probability": None, "accuracy": None, "description": "xgboost nicht installiert"}
    except Exception as e:
        logger.warning(f"[advanced] XGBoost Fehler: {e}")
        return {"direction": "UNKNOWN", "probability": None, "accuracy": None, "description": str(e)[:60]}

# ── Haupt-Funktion ────────────────────────────────────────────────────────────

def advanced_analyze(symbol: str) -> dict:
    """
    Vollständige Phase-3 Analyse für ein Symbol.
    Hurst + GARCH + XGBoost kombiniert.
    """
    sym = symbol.upper()
    logger.info(f"[advanced] Analysiere {sym}")

    try:
        closes = _load_close(sym, "1h", "30d")
        if closes is None:
            return {
                "symbol": sym,
                "error": "Zu wenig Daten",
                "hurst": {}, "garch": {}, "xgboost": {},
                "combined_signal": "NEUTRAL", "trade_confidence_boost": 0,
            }

        hurst_raw = compute_hurst(closes)
        hurst     = hurst_signal(hurst_raw)
        garch     = compute_garch(closes)
        xgb       = compute_xgboost(closes)

        # Kombinierter Boost für market_intelligence Score
        boost = 0
        signals = []

        if hurst["regime"] == "TRENDING":
            boost += 5
            signals.append("Hurst: Trending")
        elif hurst["regime"] == "MEAN_REVERSION":
            boost -= 5
            signals.append("Hurst: Mean-Reversion")

        if garch.get("vol_regime") == "HIGH_VOL":
            boost -= 3
            signals.append("GARCH: Hohe Volatilität")
        elif garch.get("vol_regime") == "LOW_VOL":
            boost += 2
            signals.append("GARCH: Niedrige Volatilität")

        xgb_dir = xgb.get("direction", "UNKNOWN")
        xgb_prob = xgb.get("probability") or 0.5
        if xgb_dir == "BUY":
            boost += int((xgb_prob - 0.5) * 20)
            signals.append(f"XGBoost: BUY ({xgb_prob:.0%})")
        elif xgb_dir == "SELL":
            boost -= int((0.5 - (1 - xgb_prob)) * 20)
            signals.append(f"XGBoost: SELL ({1-xgb_prob:.0%})")

        combined = "BUY" if boost > 5 else "SELL" if boost < -5 else "NEUTRAL"

        return {
            "symbol":                sym,
            "hurst":                 hurst,
            "garch":                 garch,
            "xgboost":               xgb,
            "combined_signal":       combined,
            "trade_confidence_boost": boost,
            "signals":               signals,
        }

    except Exception as e:
        logger.error(f"[advanced] Fehler {sym}: {e}")
        return {
            "symbol": sym, "error": str(e),
            "hurst": {}, "garch": {}, "xgboost": {},
            "combined_signal": "NEUTRAL", "trade_confidence_boost": 0,
        }
