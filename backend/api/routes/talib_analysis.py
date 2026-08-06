import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor
from services.talib_indicators import analyze_talib, talib_pattern_scan

router = APIRouter()


class MultiRequest(BaseModel):
    symbols: list[str]
    interval: str = "1d"


@router.get("/analyze/{symbol}")
async def talib_analyze(symbol: str, interval: str = "1d"):
    return await asyncio.get_event_loop().run_in_executor(None, analyze_talib, symbol, interval)


@router.post("/analyze/multi")
async def talib_analyze_multi(req: MultiRequest):
    symbols = req.symbols[:30]
    interval = req.interval

    # Parallel ausführen — alle Symbole gleichzeitig statt sequenziell.
    # asyncio.wrap_future() statt future.result(): blockiert den Event-Loop
    # NICHT (Audit-Fund #6, 27.07.).
    with ThreadPoolExecutor(max_workers=min(len(symbols), 12)) as executor:
        futures = [executor.submit(analyze_talib, s, interval) for s in symbols]
        gathered = await asyncio.gather(
            *[asyncio.wrap_future(f) for f in futures], return_exceptions=True
        )

    raw_list = []
    for sym, res in zip(symbols, gathered):
        if isinstance(res, Exception):
            raw_list.append({"symbol": sym, "error": str(res)})
        else:
            raw_list.append(res)

    results: dict = {}
    # FEHLER MITGEBEN (06.08.): bisher wurde der Grund NUR hier ins Log dieses
    # Dienstes geschrieben und dann verworfen. Im Frontend kam eine leere Liste
    # an, und dessen Meldung riet: "TA-Lib fehlend (kein yfinance-Mapping?)".
    # Am 06.08. stand diese Zeile für alle 30 Symbole im Log — nachgemessen sind
    # aber ALLE 30 in SYMBOL_MAP eingetragen und liefern über yfinance Daten.
    # Die Vermutung im Logtext war also falsch und hat die Suche in die falsche
    # Richtung geschickt. Der echte Grund lag im Log des ANDEREN Dienstes.
    # Deshalb wird er jetzt mitgeschickt: gleiche Antwort, ein Feld mehr.
    fehler: dict = {}
    for item in raw_list:
        sym = item.get("symbol")
        if not sym:
            continue
        if "error" in item:
            print(f"[talib] ⚠ {sym}: {item['error']}")
            fehler[sym] = str(item["error"])[:200]
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
            # Regime-Detection (26.07. Woche 2): bb_width = Bandbreite in % des
            # Mittelwerts. Eng = Konsolidierung/Range, weit = Expansion/Volatil.
            "bb_width":       vol.get("bb_width"),
            "adx":            trend.get("adx"),
            "ema_200":        trend.get("ema_200"),
            "above_ema200":   trend.get("above_ema200"),
            "patterns_bullish": patterns.get("bullish", []),
            "patterns_bearish": patterns.get("bearish", []),
        }
    print(f"[talib] ✅ {len(results)}/{len(symbols)} Symbole analysiert")
    if fehler:
        # Gleiche Gründe zusammenfassen — 30x derselbe Text hilft niemandem.
        gezaehlt: dict = {}
        for grund in fehler.values():
            gezaehlt[grund] = gezaehlt.get(grund, 0) + 1
        zusammenfassung = " | ".join(f"{n}x {g}" for g, n in
                                     sorted(gezaehlt.items(), key=lambda x: -x[1]))
        print(f"[talib] ⛔ {len(fehler)}/{len(symbols)} ohne Ergebnis: {zusammenfassung}")
    return {"results": results, "fehler": fehler}


@router.get("/patterns/{symbol}")
async def talib_patterns(symbol: str, interval: str = "1d"):
    return await asyncio.get_event_loop().run_in_executor(None, talib_pattern_scan, symbol, interval)
