"""
Trading Strategies API Routes
GET  /api/v1/strategies/analyze/{symbol}        → Alle 15 Strategien für 1 Symbol
POST /api/v1/strategies/analyze/multi           → Alle 15 Strategien für mehrere Symbole
GET  /api/v1/strategies/list                    → Liste aller verfügbaren Strategien
GET  /api/v1/strategies/historie/{symbol}       → 16-Strategien-Konsens rückgerechnet
GET  /api/v1/strategies/muster/{symbol}         → Chartmuster im Kursverlauf
"""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor
from services.trading_strategies import analyze_all_strategies, STRATEGIES
from services.strategie_historie import konsens_historie
from services.chartmuster import erkenne_muster

router = APIRouter(prefix="/strategies", tags=["Trading Strategies"])


class MultiRequest(BaseModel):
    symbols: list[str]


@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    try:
        # run_in_executor: 15 Strategien synchron blockierten bisher den
        # Event-Loop (gleiches Muster wie /analyze/multi, Fund #6, 27.07.).
        return await asyncio.get_event_loop().run_in_executor(None, analyze_all_strategies, symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/multi")
async def analyze_multi(req: MultiRequest):
    if len(req.symbols) > 30:
        raise HTTPException(status_code=400, detail="Max 30 Symbole")
    symbols = [s.upper() for s in req.symbols]

    # Parallel ausführen — alle Symbole gleichzeitig (15 Strategien pro Symbol).
    # asyncio.wrap_future() statt future.result(): blockiert den Event-Loop
    # NICHT (Audit-Fund #6, 27.07. — sonst hängt der ganze Service während
    # dieser Route, alle anderen Requests warten mit).
    with ThreadPoolExecutor(max_workers=min(len(symbols), 8)) as executor:
        futures = [executor.submit(analyze_all_strategies, s) for s in symbols]
        gathered = await asyncio.gather(
            *[asyncio.wrap_future(f) for f in futures], return_exceptions=True
        )

    results = []
    for sym, res in zip(symbols, gathered):
        if isinstance(res, Exception):
            print(f"[strategies] ⚠ {sym}: {res}")
        else:
            results.append(res)

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


# ── Historischer Konsens (Stufe 4, Schritt 2 — 07.08.) ───────────────────────

MAX_FENSTER_TAGE = 180
STANDARD_FENSTER_TAGE = 90


@router.get("/historie/{symbol}")
async def strategie_historie(symbol: str, tage: int = STANDARD_FENSTER_TAGE):
    """Laesst den ECHTEN 16-Strategien-Konsens durch die Vergangenheit laufen.

    Bisher pruefte der Walk-Forward drei einfache Strategien auf
    Schlusskursen — gehandelt werden 16. "UK100 robust" sagte deshalb nichts
    ueber unsere Live-Kette aus. Hier laeuft dieselbe Funktion wie live
    (analyze_all_strategies), nur mit den Daten des jeweiligen Zeitpunkts.

    tage: Laenge des Fensters, EINSTELLBAR. Die Rechenzeit faellt in diesem
    Dienst an, der alle 5 Minuten auch den Live-Scan bedient — gemessen rund
    52 ms je Balken, also etwa 14 s fuer 60 Tage auf 4h-Takt. Ueber den
    Parameter laesst sich das ohne Codeaenderung drosseln.

    Der Aufruf laeuft in einem eigenen Faden (run_in_executor): sonst wuerde
    die Rechnung den Event-Loop blockieren und ALLE anderen Anfragen dieses
    Dienstes warten lassen — derselbe Fehler, der am 27.07. als Audit-Fund #6
    behoben wurde.
    """
    if tage < 1 or tage > MAX_FENSTER_TAGE:
        raise HTTPException(
            status_code=400,
            detail=f"tage muss zwischen 1 und {MAX_FENSTER_TAGE} liegen",
        )
    sym = symbol.upper()
    schleife = asyncio.get_event_loop()
    return await schleife.run_in_executor(None, konsens_historie, sym, tage)


# ── Chartmuster (10.08.) ─────────────────────────────────────────────────────

ERLAUBTE_INTERVALLE = {"15m", "1h", "4h", "1d"}


@router.get("/muster/{symbol}")
async def chartmuster(symbol: str, interval: str = "4h"):
    """Erkennt Doppeltop/-boden, Schulter-Kopf-Schulter und Dreiecke.

    MELDET NUR. Dieses Ergebnis stimmt in keinem Konsens mit und loest kein
    Signal aus. Ob ein erkanntes Muster etwas taugt, muss erst gemessen werden
    — dafuer gibt es seit Stufe 4 die Konsens-Rueckrechnung. Ein Muster handeln
    zu lassen, bevor es gemessen wurde, waere derselbe Fehler wie eine Kennzahl
    ohne Vergleichswert.

    Laeuft im eigenen Faden: die Wendepunkt-Suche geht ueber alle Kerzen, und
    dieser Dienst bedient alle 5 Minuten auch den Live-Scan (Audit-Fund #6).
    """
    if interval not in ERLAUBTE_INTERVALLE:
        raise HTTPException(
            status_code=400,
            detail=f"interval muss eines von {sorted(ERLAUBTE_INTERVALLE)} sein",
        )
    sym = symbol.upper()

    def _lauf():
        from services.market_data import get_ohlcv
        from services.strategie_historie import _als_frame
        df = _als_frame(get_ohlcv(sym, interval, "3mo"))
        ergebnis = erkenne_muster(df)
        return {"symbol": sym, "interval": interval, "kerzen": len(df), **ergebnis}

    schleife = asyncio.get_event_loop()
    return await schleife.run_in_executor(None, _lauf)
