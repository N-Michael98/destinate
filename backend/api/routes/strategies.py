"""
Trading Strategies API Routes
GET  /api/v1/strategies/analyze/{symbol}        → Alle 15 Strategien für 1 Symbol
POST /api/v1/strategies/analyze/multi           → Alle 15 Strategien für mehrere Symbole
GET  /api/v1/strategies/list                    → Liste aller verfügbaren Strategien
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.trading_strategies import analyze_all_strategies, STRATEGIES

router = APIRouter(prefix="/strategies", tags=["Trading Strategies"])


class MultiRequest(BaseModel):
    symbols: list[str]


@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    try:
        return analyze_all_strategies(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/multi")
async def analyze_multi(req: MultiRequest):
    if len(req.symbols) > 30:
        raise HTTPException(status_code=400, detail="Max 30 Symbole")
    symbols = [s.upper() for s in req.symbols]

    # Parallel ausführen — alle Symbole gleichzeitig (15 Strategien pro Symbol)
    results = []
    with ThreadPoolExecutor(max_workers=min(len(symbols), 8)) as executor:
        futures = {executor.submit(analyze_all_strategies, s): s for s in symbols}
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                sym = futures[future]
                print(f"[strategies] ⚠ {sym}: {e}")

    print(f"[strategies] ✅ {len(results)}/{len(symbols)} Symbole analysiert")
    return {"results": {r["symbol"]: r for r in results}}


@router.get("/list")
async def list_strategies():
    return {
        "strategies": list(STRATEGIES.keys()),
        "count": len(STRATEGIES),
        "descriptions": {
            "price_action":       "Price Action: Higher Highs/Lows, Pin Bars (4h)",
            "trend_following":    "Trend Following: EMA50/200 + ADX > 25 (1d)",
            "breakout":           "Breakout: Donchian Channel 20 + Volumen (4h)",
            "mean_reversion":     "Mean Reversion: RSI Extreme + Bollinger Bands (1h)",
            "momentum":           "Momentum: RSI + ROC + MACD Histogram (4h)",
            "scalping":           "Scalping: EMA 9/21 Crossover + Stochastic (15m)",
            "support_resistance": "Support & Resistance: Pivot Bounce + RSI (4h)",
            "candlestick":        "Candlestick Patterns: 12 TA-Lib Muster (4h)",
            "ma_crossover":       "MA Crossover: Golden/Death Cross EMA20/50 (1d)",
            "donchian":           "Donchian Channel: 20 + 55-Bar Turtle System (1d)",
            "bb_squeeze":         "Bollinger Squeeze: Vola-Ausbruch nach Kompression (4h)",
            "rsi_divergence":     "RSI Divergence: Bullisch/Bärisch (4h)",
            "macd":               "MACD: Crossover + Zero-Line Breakout (4h)",
            "ict_smart_money":    "ICT/Smart Money: BOS + FVG + Order Blocks (4h)",
            "supply_demand":      "Supply & Demand: Impulszonen-Identifikation (4h)",
        }
    }
