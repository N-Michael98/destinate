from fastapi import APIRouter
from pydantic import BaseModel
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
    raw_list = [analyze_talib(s, req.interval) for s in req.symbols[:30]]
    results: dict = {}
    for item in raw_list:
        sym = item.get("symbol")
        if not sym:
            continue
        if "error" in item:
            print(f"[talib] ⚠ {sym}: {item['error']}")
            continue
        # Flatten nested structure → TAlibSummary shape
        momentum = item.get("momentum", {})
        trend    = item.get("trend", {})
        vol      = item.get("volatility", {})
        ema20 = trend.get("ema_20") or 0
        ema50 = trend.get("ema_50") or 0
        trend_str = "BULLISH" if ema20 > ema50 else "BEARISH" if ema20 < ema50 else "NEUTRAL"
        macd_val  = momentum.get("macd") or 0
        macd_sig  = momentum.get("macd_signal") or 0
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
        }
    return {"results": results}


@router.get("/patterns/{symbol}")
async def talib_patterns(symbol: str, interval: str = "1d"):
    return talib_pattern_scan(symbol, interval)
