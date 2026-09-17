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
            # Die Einzelzeile je Symbol ist am 06.08. entfallen: sie war eine
            # WIEDERHOLUNG dessen, was analyze_talib() eine Ebene tiefer schon
            # geloggt hat, und trug bei 30 Symbolen x 3 Abrufen (1d/1h/1wk) 90
            # der 660 Zeilen bei, mit denen wir Railways Grenze von 500/s
            # gerissen und 159 eigene Meldungen verloren haben. Der Grund geht
            # nicht verloren: er steht unten zusammengefasst UND wird seit heute
            # im Feld "fehler" an das Frontend mitgegeben.
            fehler[sym] = str(item["error"])[:200]
            continue
        momentum = item.get("momentum", {})
        trend    = item.get("trend", {})
        vol      = item.get("volatility", {})
        # ── AUS FEHLENDEN WERTEN WIRD KEINE RICHTUNG (17.09.) ──────────────
        #
        # Hier stand `trend.get("ema_20") or 0`. `_load_arrays` laesst ab
        # DREISSIG Kerzen durch (talib_indicators.py), die EMA50 braucht aber
        # fuenfzig und der MACD vierunddreissig. Bei 30–49 Kerzen ist `ema_50`
        # deshalb None -> 0, und `ema20 > ema50` ergab "BULLISH": eine
        # erfundene Richtung, die im Prompt ausdruecklich einen Kauf erlaubt
        # ("ONLY recommend BUY if 1D trend=BULLISH"). Beim MACD war es noch
        # schiefer -- der Vergleich kennt gar kein Unentschieden, fehlende
        # Werte ergaben also IMMER "BEARISH".
        #
        # Dazu stand die 0 auch in der Marktzeile: GPT las "ema50=0.000000"
        # neben "ema20=1.161" und sah einen gewaltigen Aufwaertstrend.
        #
        # Fehlt einer der beiden Werte, heisst das jetzt "UNKNOWN". Der
        # Analyzer selbst macht es an derselben Stelle richtig: er laesst einen
        # fehlenden Wert einfach nicht in den Score einfliessen.
        ema20 = trend.get("ema_20")
        ema50 = trend.get("ema_50")
        if ema20 is None or ema50 is None:
            trend_str = "UNKNOWN"
        else:
            trend_str = "BULLISH" if ema20 > ema50 else "BEARISH" if ema20 < ema50 else "NEUTRAL"
        macd_val = momentum.get("macd")
        macd_sig = momentum.get("macd_signal")
        if macd_val is None or macd_sig is None:
            macd_str = "UNKNOWN"
        else:
            macd_str = "BULLISH" if macd_val > macd_sig else "BEARISH"
        patterns = item.get("patterns", {})
        results[sym] = {
            "symbol":      sym,
            "signal":      item.get("signal", "NEUTRAL"),
            "score":       item.get("score", 0),
            "trend":       trend_str,
            # KEIN ERFUNDENER MITTELWERT (17.09.). Hier stand `or 50`. Fehlt
            # der RSI (zu wenige Kerzen, Indikator nicht berechenbar), wurde
            # daraus ein exakt neutraler Wert — und GPT las eine Messung, die
            # es nicht gab. `or` trifft ausserdem die echte 0: ein RSI von 0.0
            # (vierzehn Abwaertsschluesse in Folge, also maximal ueberverkauft)
            # wurde zu "neutral 50" gedreht. Fehlt er, kommt jetzt null, und
            # der Prompt schreibt "rsi=?" statt einer Zahl.
            "rsi":         momentum.get("rsi_14"),
            "macd_signal": macd_str,
            "ema_20":      ema20,
            "ema_50":      ema50,
            # `atr_14 or 0` bleibt ABSICHTLICH und geprueft (17.09.): die 0
            # wird auf der TS-Seite ueberall als "unbekannt" behandelt --
            # `getVolatilityAdjustedRisk` faellt bei `!atr` auf 40 % Risiko
            # (trade-filters.ts), und beide Stop-Pfade der Engine haengen an
            # `ta.atr > 0`. Erreichbar ist der Fall ohnehin nicht: ATR braucht
            # 14 Kerzen, durchgelassen wird erst ab 30.
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
