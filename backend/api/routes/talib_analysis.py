from fastapi import APIRouter
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.talib_indicators import analyze_talib, talib_pattern_scan

router = APIRouter()


class MultiRequest(BaseModel):
    symbols: list[str]
    interval: str = "1d"


@router.get("/analyze/{symbol}")
async def talib_analyze(symbol: str, interval: str = "1d"):
    return analyze_talib(symbol, interval)


@router.post("/analyze/multi")
async def talib_analyze_multi(req: MultiRequest):
    symbols = req.symbols[:30]
    interval = req.interval

    # Parallel ausführen — alle Symbole gleichzeitig statt sequenziell
    raw_list = []
    with ThreadPoolExecutor(max_workers=min(len(symbols), 12)) as executor:
        futures = {executor.submit(analyze_talib, s, interval): s for s in symbols}
        for future in as_completed(futures):
            try:
                raw_list.append(future.result())
            except Exception as e:
                raw_list.append({"symbol": futures[future], "error": str(e)})

    results: dict = {}
    for item in raw_list:
        sym = item.get("symbol")
        if not sym:
            continue
        if "error" in item:
            print(f"[talib] ⚠ {sym}: {item['error']}")
            continue
        momentum = item.get("momentum", {})
        trend    = item.get("trend", {})
        vol      = item.get("volatility", {})
        ema20 = trend.get("ema_20") or 0
        ema50 = trend.get("ema_50") or 0
        trend_str = "BULLISH" if ema20 > ema50 else "BEARISH" if ema20 < ema50 else "NEUTRAL"
        macd_val  = momentum.get("macd") or 0
        macd_sig  = momentum.get("macd_signal") or 0
        patterns = item.get("patterns", {})
        results[sym] = {
            "symbol":      sym,
            "signal":      item.get("signal", "NEUTRAL"),
            "score":       item.get("score", 0),
            "trend":       trend_str,
            "rsi":         momentum.get("rsi_14") or 50,
            "macd_signal": "BULLISH" if macd_val > macd_sig else "BEARISH",
            "ema_20":      ema20,
            "ema_50":      ema50,
            "atr":         vol.get("atr_14") or 0,
            # ── Schritt 1 (26.07.): bisher berechnet aber verworfen ──────────
            # Bollinger = dynamische S/R-Zonen, ADX = Trendstärke,
            # EMA200 = Haupttrend, Patterns = Umkehrsignale.
            "bb_upper":       vol.get("bb_upper"),
            "bb_middle":      vol.get("bb_middle"),
            "bb_lower":       vol.get("bb_lower"),
            "adx":            trend.get("adx"),
            "ema_200":        trend.get("ema_200"),
            "above_ema200":   trend.get("above_ema200"),
            "patterns_bullish": patterns.get("bullish", []),
            "patterns_bearish": patterns.get("bearish", []),
        }
    print(f"[talib] ✅ {len(results)}/{len(symbols)} Symbole analysiert")
    return {"results": results}


@router.get("/patterns/{symbol}")
async def talib_patterns(symbol: str, interval: str = "1d"):
    return talib_pattern_scan(symbol, interval)
