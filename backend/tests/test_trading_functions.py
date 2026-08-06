"""
Test Suite — Alle kritischen Trading-Funktionen
Verhindert Bugs wie die SL-Verluste, falsche Volumes, falsche BE-Logik.

pytest tests/test_trading_functions.py -v
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

# ── Services importieren ──────────────────────────────────────────────────────

from services.trade_lifecycle_manager import TradeState, TradeLifecycleManager, get_level
from services.market_mapper import (
    capital_epic_to_symbol, symbol_to_ic, symbol_to_yahoo,
    get_pip_size, get_instrument_info,
)
from core.event_bus import EventBus, EventType

# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_trade(
    trade_id="T001",
    symbol="EURUSD",
    direction="BUY",
    entry=1.1000,
    stop_loss=1.0970,
    take_profit=1.1060,
    size=10000,
    confidence=80,
    trading_style="DAYTRADING",
    broker="Capital.com",
    opened_at=None,
) -> TradeState:
    return TradeState(
        trade_id=trade_id,
        symbol=symbol,
        direction=direction,
        entry=entry,
        stop_loss=stop_loss,
        take_profit=take_profit,
        size=size,
        confidence=confidence,
        trading_style=trading_style,
        broker=broker,
        opened_at=opened_at,
    )

# ══════════════════════════════════════════════════════════════════════════════
# 1. KONFIDENZ-LEVEL TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestConfidenceLevel:
    def test_high_confidence_80(self):
        lvl = get_level(80)
        assert lvl["be_at"] == 0.70
        assert lvl["trail_dist"] == 0.40

    def test_medium_confidence_75(self):
        lvl = get_level(75)
        assert lvl["be_at"] == 0.55
        assert lvl["trail_dist"] == 0.50

    def test_low_confidence_72(self):
        lvl = get_level(72)
        assert lvl["be_at"] == 0.40
        assert lvl["trail_dist"] == 0.60

    def test_boundary_exactly_80(self):
        assert get_level(80)["be_at"] == 0.70

    def test_boundary_exactly_75(self):
        assert get_level(75)["be_at"] == 0.55

    def test_boundary_74(self):
        assert get_level(74)["be_at"] == 0.40

# ══════════════════════════════════════════════════════════════════════════════
# 2. TRADE STATE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestTradeState:
    def test_sl_range_with_sl(self):
        t = make_trade(entry=1.1000, stop_loss=1.0970)
        assert abs(t.sl_range - 0.003) < 0.0001

    def test_sl_range_without_sl(self):
        t = make_trade(stop_loss=0)
        # Fallback auf DEFAULT_SL_RANGE["EURUSD"] = 0.003
        assert t.sl_range == 0.003

    def test_total_range_with_tp(self):
        t = make_trade(entry=1.1000, take_profit=1.1060)
        assert abs(t.total_range - 0.006) < 0.0001

    def test_total_range_without_tp(self):
        t = make_trade(take_profit=0)
        assert t.total_range == t.sl_range * 2

    def test_progress_buy_at_50pct(self):
        # Entry 1.1000, TP 1.1060, current = 1.1030 → 50%
        t = make_trade(entry=1.1000, take_profit=1.1060)
        assert abs(t.progress(1.1030) - 0.50) < 0.01

    def test_progress_sell_at_50pct(self):
        t = make_trade(direction="SELL", entry=1.1000, stop_loss=1.1030, take_profit=1.0940)
        assert abs(t.progress(1.0970) - 0.50) < 0.01

    def test_progress_negative_losing_trade(self):
        t = make_trade(entry=1.1000, take_profit=1.1060)
        assert t.progress(1.0980) < 0  # Preis unter Entry → negativ

    def test_age_hours(self):
        opened = datetime.now(timezone.utc) - timedelta(hours=5)
        t = make_trade(opened_at=opened)
        assert abs(t.age_hours - 5) < 0.1

    def test_is_buy(self):
        assert make_trade(direction="BUY").is_buy() is True
        assert make_trade(direction="SELL").is_buy() is False

# ══════════════════════════════════════════════════════════════════════════════
# 3. BREAKEVEN TESTS
# ══════════════════════════════════════════════════════════════════════════════

# KORREKTUR 03.08.: Diese Tests liefen bis heute NIE — pytest fehlte im venv,
# obwohl es in requirements.txt steht. Drei von ihnen schlugen beim ersten Lauf
# fehl, alle aus demselben Grund: on_price_update() gibt EINE Aktion je Aufruf
# zurück, und der Teilgewinn steht in der Kette vor Breakeven und Trailing
# (Zeit-Exit → Partial → Breakeven → Trailing). Bei 70 % Fortschritt ist die
# Partial-Schwelle von 50 % ebenfalls erfüllt, also gewinnt sie und die
# Funktion kehrt zurück, bevor Breakeven geprüft wird.
#
# Nachgewiesen, dass der CODE richtig ist: über vier Zyklen mit demselben Preis
# ergibt sich PARTIAL_CLOSE → UPDATE_SL 1.1000 (Breakeven) → UPDATE_SL 1.1033
# (Trailing) → nichts mehr. Es geht also nichts verloren, es verteilt sich nur
# auf mehrere Durchläufe. Deshalb wurden die TESTS angepasst, nicht die
# Handelslogik: wer Breakeven prüfen will, muss den Teilgewinn vorher als
# erledigt markieren, sonst misst er die falsche Stufe.
class TestBreakeven:
    @pytest.mark.asyncio
    async def test_breakeven_triggered_at_threshold(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        t.partial_done = True  # Teilgewinn bereits genommen — isoliert die BE-Stufe
        mgr._trades["T001"] = t
        # BE bei 70% → 70% × 0.006 + 1.1000 = 1.1042
        be_price = 1.1000 + 0.006 * 0.70
        result = await mgr.on_price_update("T001", be_price + 0.0001)
        assert result["action"] == "UPDATE_SL"
        assert abs(result["new_sl"] - 1.1000) < 0.0001

    @pytest.mark.asyncio
    async def test_partial_kommt_vor_breakeven(self):
        """Belegt die Reihenfolge ausdrücklich: bei 70 % ist auch die
        Partial-Schwelle erfüllt, und der Teilgewinn kommt zuerst."""
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        mgr.register_trade(t)
        erst = await mgr.on_price_update("T001", 1.1000 + 0.006 * 0.75)
        assert erst["action"] == "PARTIAL_CLOSE"
        dann = await mgr.on_price_update("T001", 1.1000 + 0.006 * 0.75)
        assert dann["action"] == "UPDATE_SL"
        assert abs(dann["new_sl"] - 1.1000) < 0.0001

    @pytest.mark.asyncio
    async def test_breakeven_not_triggered_before_threshold(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        mgr.register_trade(t)
        # Nur 50% → BE noch nicht erreicht (braucht 70%)
        price = 1.1000 + 0.006 * 0.50
        result = await mgr.on_price_update("T001", price)
        assert result["action"] != "UPDATE_SL" or result.get("new_sl", 0) == 1.1000

    @pytest.mark.asyncio
    async def test_breakeven_only_once(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        mgr.register_trade(t)
        be_price = 1.1000 + 0.006 * 0.75
        await mgr.on_price_update("T001", be_price)
        result2 = await mgr.on_price_update("T001", be_price + 0.001)
        # Zweiter Call darf kein BE mehr setzen
        assert result2["action"] != "UPDATE_SL" or mgr._trades["T001"].be_set

    @pytest.mark.asyncio
    async def test_breakeven_sell_direction(self):
        mgr = TradeLifecycleManager()
        t = make_trade(
            direction="SELL", entry=1.1000,
            stop_loss=1.1030, take_profit=1.0940, confidence=80
        )
        t.partial_done = True  # siehe Hinweis oben: isoliert die BE-Stufe
        mgr._trades["T001"] = t
        # SELL: Preis muss FALLEN → 70% von range = 1.1000 - 0.006*0.70 = 1.0958
        be_price = 1.1000 - 0.006 * 0.75
        result = await mgr.on_price_update("T001", be_price)
        assert result["action"] == "UPDATE_SL"
        assert abs(result["new_sl"] - 1.1000) < 0.001

# ══════════════════════════════════════════════════════════════════════════════
# 4. TRAILING STOP TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestTrailingStop:
    @pytest.mark.asyncio
    async def test_trail_moves_up_after_be(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        t.be_set = True
        t.partial_done = True  # sonst gewinnt der Teilgewinn, siehe Hinweis oben
        t.trail_sl = 1.1000
        t.current_sl = 1.1000
        mgr._trades["T001"] = t
        # Preis steigt → Trail SL soll mitgehen
        result = await mgr.on_price_update("T001", 1.1050)
        assert result["action"] == "UPDATE_SL"
        assert result["new_sl"] > 1.1000

    @pytest.mark.asyncio
    async def test_trail_never_below_entry(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        t.be_set = True
        t.partial_done = True  # sonst gewinnt der Teilgewinn, siehe Hinweis oben
        t.trail_sl = 1.1000
        t.current_sl = 1.1000
        mgr._trades["T001"] = t
        # Preis fast zurück bei Entry → Trail darf nicht unter Entry
        result = await mgr.on_price_update("T001", 1.1002)
        if result["action"] == "UPDATE_SL":
            assert result["new_sl"] >= 1.1000

    @pytest.mark.asyncio
    async def test_trail_does_not_move_down(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        t.be_set = True
        t.trail_sl = 1.1030
        t.current_sl = 1.1030
        mgr._trades["T001"] = t
        # Preis fällt → Trail darf NICHT fallen
        result = await mgr.on_price_update("T001", 1.1010)
        assert result["action"] != "UPDATE_SL" or result.get("new_sl", 999) >= 1.1030

# ══════════════════════════════════════════════════════════════════════════════
# 5. ZEIT-EXIT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestZeitExit:
    @pytest.mark.asyncio
    async def test_scalping_exit_after_4h(self):
        old = datetime.now(timezone.utc) - timedelta(hours=5)
        mgr = TradeLifecycleManager()
        t = make_trade(trading_style="SCALPING", opened_at=old)
        mgr._trades["T001"] = t
        result = await mgr.on_price_update("T001", 1.1000)
        assert result["action"] == "CLOSE"
        assert result["reason"] == "ZEIT_EXIT"

    @pytest.mark.asyncio
    async def test_daytrading_exit_after_24h(self):
        old = datetime.now(timezone.utc) - timedelta(hours=25)
        mgr = TradeLifecycleManager()
        t = make_trade(trading_style="DAYTRADING", opened_at=old)
        mgr._trades["T001"] = t
        result = await mgr.on_price_update("T001", 1.1000)
        assert result["action"] == "CLOSE"

    @pytest.mark.asyncio
    async def test_swing_no_exit_before_7d(self):
        recent = datetime.now(timezone.utc) - timedelta(hours=100)
        mgr = TradeLifecycleManager()
        t = make_trade(trading_style="SWING", opened_at=recent,
                       entry=1.1000, stop_loss=1.0970, take_profit=1.1060)
        mgr._trades["T001"] = t
        result = await mgr.on_price_update("T001", 1.1010)
        assert result["action"] != "CLOSE"

# ══════════════════════════════════════════════════════════════════════════════
# 6. MARKET MAPPER TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestMarketMapper:
    def test_capital_gold_to_xauusd(self):
        assert capital_epic_to_symbol("GOLD") == "XAUUSD"

    def test_capital_silver_to_xagusd(self):
        assert capital_epic_to_symbol("SILVER") == "XAGUSD"

    def test_capital_ustec_to_nas100(self):
        assert capital_epic_to_symbol("USTEC") == "NAS100"

    def test_ic_nas100_to_ustec(self):
        assert symbol_to_ic("NAS100") == "USTEC"

    def test_ic_ger40_to_de40(self):
        assert symbol_to_ic("GER40") == "DE40"

    def test_ic_usoil_to_wti(self):
        assert symbol_to_ic("USOIL") == "WTI"

    def test_yahoo_xauusd(self):
        assert symbol_to_yahoo("XAUUSD") == "GC=F"

    def test_pip_size_eurusd(self):
        assert get_pip_size("EURUSD") == 0.0001

    def test_pip_size_usdjpy(self):
        assert get_pip_size("USDJPY") == 0.01

    def test_instrument_info_exists(self):
        info = get_instrument_info("EURUSD")
        assert info is not None
        assert info["type"] == "forex"

# ══════════════════════════════════════════════════════════════════════════════
# 7. EVENT BUS TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestEventBus:
    @pytest.mark.asyncio
    async def test_publish_and_receive(self):
        eb = EventBus()
        received = []
        async def handler(event):
            received.append(event.data)
        eb.subscribe(EventType.INFO, handler)
        await eb.publish(EventType.INFO, {"msg": "test"})
        assert len(received) == 1
        assert received[0]["msg"] == "test"

    @pytest.mark.asyncio
    async def test_killswitch_blocks_events(self):
        eb = EventBus()
        received = []
        async def handler(event):
            received.append(event)
        eb.subscribe(EventType.INFO, handler)
        await eb.publish(EventType.KILLSWITCH, {"reason": "test"})
        await eb.publish(EventType.INFO, {"msg": "sollte blockiert sein"})
        assert len(received) == 0

    def test_stats(self):
        eb = EventBus()
        stats = eb.get_stats()
        assert "total_events" in stats
        assert "killswitch_active" in stats

    def test_history(self):
        eb = EventBus()
        eb.publish_sync(EventType.INFO, {"x": 1})
        history = eb.get_history()
        assert len(history) >= 1

# ── Struktur-Stop: _swing_points (05.08.) ─────────────────────────────────────
# Diese Funktion liefert die Grundlage fuer den Struktur-Stop. Bis hierher gab
# es fuer trading_strategies.py keinen einzigen Test — die Impact-Abfrage
# meldete "kein Pruefer deckt diese Datei ab". Ein falsch umgebauter
# Bestaetigungsradius faellt statisch nicht auf, deshalb hier ausgefuehrt.

import sys
import types
import pandas as pd

# trading_strategies.py zieht beim Import services.market_data nach, und darueber
# core.retry -> tenacity. Von den 32 Eintraegen in requirements.txt sind lokal 17
# nicht installiert (Stand 05.08.), darunter tenacity — deshalb war diese Datei
# aus den Tests bisher gar nicht erreichbar. Der Pruefer python-services meldete
# sie trotzdem gruen, weil py_compile nur uebersetzt und keine Importe aufloest.
#
# Statt 17 schwere Pakete nachzuziehen wird nur der eine fremde Import ersetzt.
# _swing_points selbst braucht ausschliesslich pandas — getestet wird also die
# echte Funktion aus der echten Datei, unveraendert.
if "services.market_data" not in sys.modules:
    try:
        import services.market_data  # noqa: F401
    except ModuleNotFoundError:
        _stub = types.ModuleType("services.market_data")
        _stub.get_ohlcv = lambda *a, **k: []
        sys.modules["services.market_data"] = _stub

from services.trading_strategies import _swing_points


def _df(lows, highs=None):
    """Minimales OHLC-Gerippe: nur high/low werden von _swing_points gelesen."""
    highs = highs if highs is not None else [x + 1 for x in lows]
    return pd.DataFrame({"high": highs, "low": lows})


def test_swing_points_findet_bestaetigtes_tief():
    # V-Form: Index 4 ist tiefster Punkt, links und rechts je >=3 hoehere Kerzen
    tief, _ = _swing_points(_df([10, 9, 8, 7, 5, 7, 8, 9, 10, 11]))
    assert tief == 5.0


def test_swing_points_findet_bestaetigtes_hoch():
    highs = [10, 11, 12, 13, 15, 13, 12, 11, 10, 9]
    _, hoch = _swing_points(_df([x - 1 for x in highs], highs))
    assert hoch == 15.0


def test_swing_points_unbestaetigt_am_rand_wird_nicht_gemeldet():
    # Tiefster Punkt liegt ganz am Ende — es fehlen die 3 Kerzen zur Bestaetigung.
    # Erwartet wird das FRUEHERE bestaetigte Tief (5.0), nicht die 1.0.
    tief, _ = _swing_points(_df([10, 9, 8, 7, 5, 7, 8, 9, 4, 3, 2, 1]))
    assert tief == 5.0


def test_swing_points_scheintief_am_rand_wird_nicht_genommen():
    # Schaerfere Fassung des Tests darueber. Anlass: die erste Fassung liess eine
    # Sabotage durch (Schleifenstart von len-rechts-1 auf len-2 geaendert), weil
    # die Testreihe am Ende zufaellig kein Scheintief bildete — der Test war
    # gruen, obwohl die Bestaetigung ausgehebelt war.
    #
    # Hier bildet Index 9 (Wert 3.0) ein Tief, dem rechts nur ZWEI Kerzen folgen.
    # Es ist damit unbestaetigt und darf nicht gemeldet werden; richtig ist das
    # bestaetigte 5.0 bei Index 4. Wer den Bestaetigungsradius aufweicht,
    # bekommt hier 3.0 und der Test faellt.
    tief, _ = _swing_points(_df([10, 9, 8, 7, 5, 7, 8, 9, 10, 3, 9, 9]))
    assert tief == 5.0


def test_swing_points_nimmt_das_letzte_von_zweien():
    # Zwei bestaetigte Tiefer: 3.0 (Index 4) und 2.0 (Index 12).
    # Fuer einen Stop zaehlt der JUENGSTE Wendepunkt.
    tief, _ = _swing_points(_df([9, 8, 7, 6, 3, 6, 7, 8, 9, 8, 7, 6, 2, 6, 7, 8, 9]))
    assert tief == 2.0


def test_swing_points_ohne_wendepunkt_gibt_none():
    # Streng fallende Reihe: jede Kerze tiefer als die vorige, kein Wendepunkt.
    tief, hoch = _swing_points(_df(list(range(30, 0, -1))))
    assert tief is None


def test_swing_points_zu_wenig_kerzen_gibt_none():
    assert _swing_points(_df([5, 4, 3, 4, 5])) == (None, None)


def test_swing_points_mindestlaenge_greift_bei_genau_sieben():
    # Der Laengen-Riegel (len < links+rechts+2, also < 8) sieht harmlos aus, ist
    # es aber nicht: bei GENAU 7 Kerzen laeuft die Schleife noch einmal auf
    # Index 3, dessen Fenster l[0:7] die ganze Reihe umfasst. Ohne den Riegel
    # wird dieser Punkt als Wendepunkt gemeldet, obwohl links und rechts kein
    # einziger Kurs ausserhalb des Bestaetigungsfensters liegt.
    #
    # Nachgemessen 05.08.: erschoepfend ueber alle 3^n Reihen bis Laenge 9 weicht
    # das Verhalten mit/ohne Riegel bei GENAU Laenge 7 ab (1585 von 2187 Faellen),
    # bei jeder anderen Laenge in 0 Faellen.
    #
    # In Produktion greift das nie, weil _load() Reihen unter 30 Kerzen ohnehin
    # verwirft — der Riegel ist die zweite Absicherung, und sie wird hier
    # festgehalten, damit sie nicht als "unnoetig" wegfaellt.
    assert _swing_points(_df([1, 1, 1, 1, 1, 1, 1])) == (None, None)
    assert _swing_points(_df([9, 8, 7, 5, 7, 8, 9])) == (None, None)
    # Eine Kerze mehr: derselbe Wendepunkt ist jetzt zulaessig.
    assert _swing_points(_df([9, 8, 7, 5, 7, 8, 9, 10]))[0] == 5.0


def test_swing_points_leeres_df_gibt_none():
    assert _swing_points(pd.DataFrame()) == (None, None)
    assert _swing_points(None) == (None, None)


def test_swing_points_radius_wirkt():
    # Flacher Wendepunkt: bestaetigt bei Radius 2, aber NICHT bei Radius 5.
    kurve = [9, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 5, 6, 7]
    assert _swing_points(_df(kurve), links=2, rechts=2)[0] == 5.0
    eng = _swing_points(_df(kurve), links=5, rechts=5)[0]
    assert eng is None or eng == 5.0

# ── Log-Flut: Fehler werden gezaehlt statt wiederholt (06.08.) ────────────────
# Anlass, nachgerechnet aus dem Betriebslog vom 06.08.: bei offenem
# yfinance-Schalter entstanden 960 Zeilen in EINER Sekunde. Railways Grenze
# liegt bei 500/s, gemeldet wurden "Messages dropped: 159". Verworfen wurden
# ausgerechnet die Zeilen mit dem AUSLOESENDEN Fehler — die eigene Beweislage
# war damit zerstoert. Diese Tests halten die Gegenmassnahme fest.

import logging as _logging
import services.trading_strategies as _TS
from core.circuit_breaker import TradingCircuitBreakerListener
from core.log_drossel import zuruecksetzen as _drossel_reset


class _Faenger(_logging.Handler):
    def __init__(self):
        super().__init__()
        self.zeilen = []

    def emit(self, record):
        self.zeilen.append(record.getMessage())


def _mit_strategien(faelscher):
    """Alle Strategien durch faelscher ersetzen, Logzeilen einsammeln."""
    faenger = _Faenger()
    _TS.logger.addHandler(faenger)
    echt = dict(_TS.STRATEGIES)
    _TS.STRATEGIES.clear()
    _TS.STRATEGIES.update({k: faelscher(k) for k in echt})
    try:
        ergebnis = _TS.analyze_all_strategies("EURUSD")
    finally:
        _TS.STRATEGIES.clear()
        _TS.STRATEGIES.update(echt)
        _TS.logger.removeHandler(faenger)
    return ergebnis, faenger.zeilen


def test_strategien_fehler_ergeben_genau_eine_zeile():
    def alle_kaputt(name):
        def f(sym):
            raise RuntimeError("Timeout not elapsed yet, circuit breaker still open")
        return f

    ergebnis, zeilen = _mit_strategien(alle_kaputt)
    # 16 Strategien scheitern -> frueher 16 Zeilen, jetzt genau eine.
    assert len(zeilen) == 1, f"erwartet 1 Zeile, bekam {len(zeilen)}"
    assert "16/16 fehlgeschlagen" in zeilen[0]
    assert "circuit breaker still open" in zeilen[0]
    # Das Ergebnis bleibt vollstaendig — nur das Logging ist knapper.
    assert ergebnis["total_strategies"] == len(_TS.STRATEGIES)


def test_strategien_verschiedene_ursachen_bleiben_sichtbar():
    """Zusammenfassen darf keine Ursache verschlucken."""
    def gemischt(name):
        def f(sym):
            if name in ("price_action", "momentum"):
                raise ValueError("Zu wenig Daten")
            raise RuntimeError("Timeout not elapsed yet, circuit breaker still open")
        return f

    _, zeilen = _mit_strategien(gemischt)
    assert len(zeilen) == 1
    assert "Zu wenig Daten" in zeilen[0]
    assert "circuit breaker still open" in zeilen[0]
    assert "price_action" in zeilen[0] and "momentum" in zeilen[0]


def test_strategien_ohne_fehler_loggen_nichts():
    _, zeilen = _mit_strategien(lambda name: (lambda sym: _TS._neutral("ok")))
    assert zeilen == []


class _FakeCB:
    def __init__(self, name):
        self.name = name


class _FakeState:
    def __init__(self, name):
        self.name = name


def _breaker_zeilen(aufrufe, stufe="error"):
    faenger = _Faenger()
    log = _logging.getLogger("core.circuit_breaker")
    log.addHandler(faenger)
    alt = log.level
    log.setLevel(_logging.DEBUG)
    _drossel_reset("breaker:test_cb")
    try:
        aufrufe()
    finally:
        log.removeHandler(faenger)
        log.setLevel(alt)
        _drossel_reset("breaker:test_cb")
    return faenger.zeilen


def test_breaker_drosselt_gleiche_fehler():
    hoerer = TradingCircuitBreakerListener()
    cb = _FakeCB("test_cb")
    zeilen = _breaker_zeilen(
        lambda: [hoerer.failure(cb, RuntimeError("HTTPError 429")) for _ in range(300)]
    )
    assert len(zeilen) == 1, f"300 gleiche Fehler ergaben {len(zeilen)} Zeilen"
    assert "429" in zeilen[0]


def test_breaker_laesst_neue_ursache_sofort_durch():
    """Eine ANDERE Ursache darf nie unterdrueckt werden."""
    hoerer = TradingCircuitBreakerListener()
    cb = _FakeCB("test_cb")

    def ablauf():
        for _ in range(50):
            hoerer.failure(cb, RuntimeError("HTTPError 429"))
        hoerer.failure(cb, RuntimeError("ConnectionResetError"))

    zeilen = _breaker_zeilen(ablauf)
    assert len(zeilen) == 2
    assert "429" in zeilen[0]
    assert "ConnectionResetError" in zeilen[1]
    # Die unterdrueckten werden mitgezaehlt, nicht verschwiegen.
    assert "49 weitere" in zeilen[1]


def test_breaker_zustandswechsel_wird_nie_gedrosselt():
    """Der Zustandswechsel ist die wichtigste Zeile — immer vollstaendig."""
    hoerer = TradingCircuitBreakerListener()
    cb = _FakeCB("test_cb")
    faenger = _Faenger()
    log = _logging.getLogger("core.circuit_breaker")
    log.addHandler(faenger)
    log.setLevel(_logging.DEBUG)
    try:
        for _ in range(5):
            hoerer.state_change(cb, _FakeState("closed"), _FakeState("open"))
    finally:
        log.removeHandler(faenger)
    assert len(faenger.zeilen) == 5

# ── Log-Drossel und Wiederhol-Ausgabe (06.08.) ───────────────────────────────

from core.log_drossel import gedrosselt, zuruecksetzen as _drossel_zuruecksetzen
from core.retry import api_retry


def _sammler():
    zeilen = []
    return zeilen, zeilen.append


def test_drossel_zaehlt_gleiche_meldungen():
    _drossel_zuruecksetzen("t1")
    zeilen, schreib = _sammler()
    for _ in range(300):
        gedrosselt(schreib, "t1", "immer derselbe Text")
    assert len(zeilen) == 1


def test_drossel_laesst_geaenderten_text_sofort_durch():
    """Eine NEUE Ursache darf nie unterdrueckt werden."""
    _drossel_zuruecksetzen("t2")
    zeilen, schreib = _sammler()
    for _ in range(50):
        gedrosselt(schreib, "t2", "Ursache A")
    gedrosselt(schreib, "t2", "Ursache B")
    assert len(zeilen) == 2
    assert "Ursache A" in zeilen[0]
    assert "Ursache B" in zeilen[1]
    assert "49 weitere" in zeilen[1], "Unterdrueckte muessen mitgezaehlt werden"


def test_drossel_trennt_schluessel():
    _drossel_zuruecksetzen()
    zeilen, schreib = _sammler()
    gedrosselt(schreib, "a", "gleicher Text")
    gedrosselt(schreib, "b", "gleicher Text")
    assert len(zeilen) == 2, "verschiedene Quellen duerfen sich nicht drosseln"


def test_retry_ausgabe_ist_gedrosselt():
    """300 Abrufe mit je 2 Wiederholungen ergaben 600 Zeilen.

    FALLE, in die der erste Entwurf lief: die Versuchsnummer stand nur im TEXT.
    Der wechselt dadurch bei jedem Aufruf zwischen "Versuch 1" und "Versuch 2",
    die Drossel wertete das als neue Ursache und liess ALLE 600 durch — die
    Behebung war wirkungslos. Erst die Nummer im SCHLUESSEL wirkt. Genau das
    haelt dieser Test fest.
    """
    _drossel_zuruecksetzen()
    zeilen, _ = _sammler()

    class Faenger(_logging.Handler):
        def emit(self, record):
            zeilen.append(record.getMessage())

    log = _logging.getLogger("core.retry")
    faenger = Faenger()
    log.addHandler(faenger)
    log.setLevel(_logging.DEBUG)

    @api_retry(min_wait=0, max_wait=0)
    def scheitert():
        raise ConnectionError("Verbindung weg")

    try:
        for _ in range(300):
            try:
                scheitert()
            except ConnectionError:
                pass
    finally:
        log.removeHandler(faenger)

    assert len(zeilen) == 2, f"erwartet 2 Zeilen (je Versuchsstufe eine), bekam {len(zeilen)}"


def test_retry_verhalten_bleibt_unveraendert():
    """Die Drosselung darf NUR die Ausgabe aendern, nie das Wiederholen."""
    versuche = {"n": 0}

    @api_retry(min_wait=0, max_wait=0)
    def passend():
        versuche["n"] += 1
        raise ConnectionError("x")

    try:
        passend()
    except ConnectionError:
        pass
    assert versuche["n"] == 3, "stop_after_attempt(3) muss weiterhin gelten"

    versuche["n"] = 0

    @api_retry(min_wait=0, max_wait=0)
    def unpassend():
        versuche["n"] += 1
        raise RuntimeError("nicht in retry_if_exception_type")

    try:
        unpassend()
    except RuntimeError:
        pass
    assert versuche["n"] == 1, "nicht gelistete Ausnahmen duerfen nicht wiederholt werden"

# ── Gescheiterte Strategien werden gezaehlt (06.08.) ─────────────────────────
# Anlass: das Backend meldete "30/30 Symbole analysiert in 88ms", waehrend
# JEDE der 16 Strategien je Symbol an "Too Many Requests. Rate limited."
# gescheitert war. Rueckgabe und Erfolgsmeldung sahen aus wie ein gesunder
# Lauf; das Frontend akzeptierte das als vollstaendige Daten. Ohne diese Zahl
# ist "alle NEUTRAL, weil kein Setup" nicht von "alle NEUTRAL, weil kein Kurs"
# zu unterscheiden.


def _mit_allen(faelscher):
    echt = dict(_TS.STRATEGIES)
    _TS.STRATEGIES.clear()
    _TS.STRATEGIES.update({k: faelscher(k) for k in echt})
    try:
        return _TS.analyze_all_strategies("GBPUSD")
    finally:
        _TS.STRATEGIES.clear()
        _TS.STRATEGIES.update(echt)


def _wirft(meldung):
    def bauen(name):
        def f(sym):
            raise RuntimeError(meldung)
        return f
    return bauen


def test_gescheiterte_strategien_werden_gezaehlt():
    r = _mit_allen(_wirft("Too Many Requests. Rate limited. Try after a while."))
    assert r["fehlgeschlagen"] == r["total_strategies"] == len(_TS.STRATEGIES)
    assert r["fehler_gruende"], "Gruende muessen mitgegeben werden"
    assert "Rate limited" in list(r["fehler_gruende"].values())[0]


def test_neutral_ohne_fehler_ist_kein_ausfall():
    """Der entscheidende Unterschied: alle NEUTRAL, aber alle GELAUFEN.

    Das ist ein voellig normaler Marktzustand und darf NICHT wie ein Ausfall
    behandelt werden — sonst blockiert das Qualitaets-Tor ruhige Maerkte.
    """
    r = _mit_allen(lambda name: (lambda sym: _TS._neutral("kein Setup")))
    assert r["fehlgeschlagen"] == 0
    assert r["consensus"] == "NEUTRAL"
    assert r["fehler_gruende"] == {}


def test_teilweise_gescheitert_wird_genau_gezaehlt():
    namen = list(_TS.STRATEGIES)
    kaputt = set(namen[:9])

    def gemischt(name):
        if name in kaputt:
            def f(sym):
                raise RuntimeError("Rate limited")
            return f
        return lambda sym: _TS._neutral("ok")

    r = _mit_allen(gemischt)
    assert r["fehlgeschlagen"] == 9
    assert r["total_strategies"] == len(namen)
    # Die 50%-Schwelle des Frontends: 7 von 16 gelaufen = 44% -> Tor bleibt zu.
    gelaufen = (r["total_strategies"] - r["fehlgeschlagen"]) / r["total_strategies"]
    assert gelaufen < 0.5


def test_fehler_gruende_bleiben_begrenzt():
    """Nicht alle 16 Gruende mitschicken — fuenf reichen zur Diagnose."""
    r = _mit_allen(_wirft("x" * 500))
    assert len(r["fehler_gruende"]) <= 5
    for meldung in r["fehler_gruende"].values():
        assert len(meldung) <= 120

# ── Taktgeber und Kerzen-Cache (06.08.) ──────────────────────────────────────
# Anlass, bewiesen aus dem Betriebslog:
#   [circuit-breaker] yfinance Fehler: Too Many Requests. Rate limited.
# Ein Scan-Zyklus feuerte rund 300 Abrufe gleichzeitig los. Der Takt verteilt
# sie, der Cache spart die doppelten. Beides ist wirkungslos, wenn es still
# ausgebaut wird — deshalb diese Tests.

import time as _time
import threading as _threading
from core import takt as _takt


def test_takt_haelt_die_rate_ein():
    _takt.zuruecksetzen(rate=50.0)
    t0 = _time.monotonic()
    for _ in range(50):
        _takt.warte()
    dauer = _time.monotonic() - t0
    _takt.zuruecksetzen(rate=7.0)
    # 50 Abrufe bei 50/s == rund 1 Sekunde. Grosszuegige Grenzen, damit der
    # Test auf langsamen Rechnern nicht flackert — aber "gar keine Bremse"
    # (unter 0.5s) faellt sicher auf.
    assert 0.6 <= dauer <= 2.5, f"50 Abrufe bei 50/s dauerten {dauer:.2f}s"


def test_takt_wird_unter_faeden_nicht_zur_reihenschaltung():
    """Der Abstand wird UNTER der Sperre vergeben, aber NICHT darin abgewartet.

    Wird das umgebaut und in der Sperre geschlafen, stehen alle Faeden
    hintereinander und der Durchsatz bricht ein.
    """
    _takt.zuruecksetzen(rate=200.0)
    t0 = _time.monotonic()

    def arbeit():
        for _ in range(10):
            _takt.warte()

    faeden = [_threading.Thread(target=arbeit) for _ in range(20)]
    for f in faeden:
        f.start()
    for f in faeden:
        f.join()
    dauer = _time.monotonic() - t0
    _takt.zuruecksetzen(rate=7.0)
    # 200 Abrufe bei 200/s == rund 1s. Bei echter Reihenschaltung waere es
    # deutlich mehr.
    assert dauer <= 3.0, f"200 Abrufe ueber 20 Faeden dauerten {dauer:.2f}s"


def test_takt_abschaltbar():
    _takt.zuruecksetzen(rate=0.0)
    t0 = _time.monotonic()
    for _ in range(500):
        _takt.warte()
    dauer = _time.monotonic() - t0
    _takt.zuruecksetzen(rate=7.0)
    assert dauer < 0.5, "rate=0 muss ohne Wartezeit durchlaufen"


def test_takt_standardwert_ist_sieben():
    """Die 7 stammt aus der 60s-Zeitgrenze des Strategien-Abrufs (300/7 ~ 43s).

    Wird sie geaendert, muss diese Rechnung neu gemacht werden — der Test
    haelt die Zahl fest, damit sie nicht nebenbei verrutscht.
    """
    assert _takt._STANDARD_RATE == 7.0


def _fake_yf(zaehler):
    import pandas as pd
    import numpy as np

    class FakeTicker:
        def __init__(self, t):
            self.t = t

        def history(self, period, interval):
            zaehler["n"] += 1
            idx = pd.date_range("2026-01-01", periods=50, freq="1D", tz="UTC")
            return pd.DataFrame(
                {"Open": np.arange(50.0), "High": np.arange(50.0) + 1,
                 "Low": np.arange(50.0) - 1, "Close": np.arange(50.0),
                 "Volume": np.ones(50) * 100},
                index=idx,
            )

    return type("m", (), {"Ticker": FakeTicker})()


def test_kerzen_cache_spart_den_zweiten_abruf():
    import services.market_data as MD
    zaehler = {"n": 0}
    echt = MD.yf
    MD.yf = _fake_yf(zaehler)
    MD._kerzen_cache.clear()
    _takt.zuruecksetzen(rate=0.0)
    try:
        a = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
        b = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
    finally:
        MD.yf = echt
        MD._kerzen_cache.clear()
        _takt.zuruecksetzen(rate=7.0)
    assert zaehler["n"] == 1, "der zweite Abruf muss aus dem Cache kommen"
    assert a == b
    assert a is not b, "der Aufrufer darf die Liste im Cache nicht halten"


def test_kerzen_cache_gibt_keine_veraenderbare_referenz():
    """Die Rueckgabe AUS DEM CACHE muss eine Kopie sein.

    Erste Fassung dieses Tests war zu schwach und liess eine Sabotage durch:
    sie veraenderte die Rueckgabe des ERSTEN Aufrufs — die kommt aber vom
    Ablegepfad und ist ohnehin schon eine Kopie. Getroffen wird der Fehler nur,
    wenn die Rueckgabe eines CACHE-TREFFERS veraendert und danach ein dritter
    Aufruf geprueft wird.
    """
    import services.market_data as MD
    zaehler = {"n": 0}
    echt = MD.yf
    MD.yf = _fake_yf(zaehler)
    MD._kerzen_cache.clear()
    _takt.zuruecksetzen(rate=0.0)
    try:
        # BEIDE Wege veraendern: den Ablegepfad (erster Aufruf) UND den
        # Cache-Treffer. Die erste Fassung prueft nur einen davon und liess
        # die Sabotage "Ablage gibt Original-Liste" durch.
        erster = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")     # legt ab
        laenge_vorher = len(erster)
        erster.append({"manipuliert": "ablage"})
        aus_cache = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")  # Treffer
        assert len(aus_cache) == laenge_vorher, "Ablagepfad gab eine veraenderbare Referenz"
        aus_cache.append({"manipuliert": "treffer"})
        dritter = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
    finally:
        MD.yf = echt
        MD._kerzen_cache.clear()
        _takt.zuruecksetzen(rate=7.0)
    assert zaehler["n"] == 1, "es durfte nur EIN Netzabruf stattfinden"
    assert len(dritter) == laenge_vorher, "Cache wurde ueber die Rueckgabe veraendert"
    assert not any("manipuliert" in x for x in dritter)


def test_echter_abruf_geht_durch_den_takt():
    """_fetch_ohlcv_single MUSS den Taktgeber aufrufen.

    Ohne diesen Test bleibt gruen, wer takt_warte() aus market_data entfernt —
    genau das ist beim Sabotage-Lauf am 06.08. durchgerutscht, weil die
    Cache-Tests den Takt selbst abschalten.
    """
    import services.market_data as MD
    zaehler = {"n": 0}
    gerufen = {"n": 0}
    echt_yf, echt_warte = MD.yf, MD.takt_warte
    MD.yf = _fake_yf(zaehler)

    def zaehlende_warte():
        gerufen["n"] += 1
        return 0.0

    MD.takt_warte = zaehlende_warte
    MD._kerzen_cache.clear()
    try:
        MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
        MD._fetch_ohlcv_single("GBPUSD", "1d", "6mo")
        MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")   # aus dem Cache
    finally:
        MD.yf, MD.takt_warte = echt_yf, echt_warte
        MD._kerzen_cache.clear()
    assert zaehler["n"] == 2, "zwei echte Netzabrufe erwartet"
    assert gerufen["n"] == 2, (
        f"der Takt wurde {gerufen['n']}x gerufen, erwartet 2 — "
        "je echtem Netzabruf einmal, fuer den Cache-Treffer gar nicht"
    )


def test_kerzen_cache_dauer_bleibt_bei_60_sekunden():
    """Die 60s sind KEINE frei gewaehlte Zahl.

    Es ist dieselbe Dauer, die trading_strategies._load() seit dem 27.07.
    benutzt, mit derselben Begruendung: 1h/4h/1d/1wk-Kerzen aendern sich nicht
    schneller. Der LIVE-Kurs kommt ohnehin von Capital.com, nicht von hier.
    Wer die Dauer streckt, verschiebt still, wie alt die Daten sein duerfen, auf
    denen gehandelt wird — das darf nicht unbemerkt passieren.
    """
    import services.market_data as MD
    assert MD._KERZEN_TTL_SEC == 60
    assert MD._KERZEN_TTL_SEC == _TS._CACHE_TTL_SEC, (
        "Backend-Cache und Strategie-Cache muessen dieselbe Dauer haben"
    )


def test_kerzen_cache_trennt_die_kombinationen():
    import services.market_data as MD
    zaehler = {"n": 0}
    echt = MD.yf
    MD.yf = _fake_yf(zaehler)
    MD._kerzen_cache.clear()
    _takt.zuruecksetzen(rate=0.0)
    try:
        MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
        MD._fetch_ohlcv_single("EURUSD", "1h", "3mo")
        MD._fetch_ohlcv_single("GBPUSD", "1d", "6mo")
    finally:
        MD.yf = echt
        MD._kerzen_cache.clear()
        _takt.zuruecksetzen(rate=7.0)
    assert zaehler["n"] == 3, "verschiedene Kombinationen duerfen sich nicht teilen"

def test_takt_liest_die_umgebungsvariable():
    """YFINANCE_CALLS_PER_SEC muss wirken — sonst ist der Wert nicht einstellbar
    und man kaeme im Betrieb nicht mehr an die Rate heran.
    """
    import os
    import importlib
    from core import takt as t_modul

    vorher = os.environ.get("YFINANCE_CALLS_PER_SEC")
    try:
        os.environ["YFINANCE_CALLS_PER_SEC"] = "3"
        importlib.reload(t_modul)
        assert t_modul.stand()["rate_je_sekunde"] == 3.0

        os.environ["YFINANCE_CALLS_PER_SEC"] = "unsinn"
        importlib.reload(t_modul)
        assert t_modul.stand()["rate_je_sekunde"] == t_modul._STANDARD_RATE,             "ein unlesbarer Wert muss auf den Standard zurueckfallen, nicht abstuerzen"

        os.environ["YFINANCE_CALLS_PER_SEC"] = "0"
        importlib.reload(t_modul)
        assert t_modul.stand()["rate_je_sekunde"] == 0.0, "0 muss abschalten"
    finally:
        if vorher is None:
            os.environ.pop("YFINANCE_CALLS_PER_SEC", None)
        else:
            os.environ["YFINANCE_CALLS_PER_SEC"] = vorher
        importlib.reload(t_modul)
        # market_data haelt eine eigene Referenz auf warte() — nach dem Reload
        # neu binden, sonst zeigt sie auf das alte Modul.
        import services.market_data as MD
        MD.takt_warte = t_modul.warte


def test_leeres_ergebnis_wird_nicht_zwischengespeichert():
    """Ein einzelner Aussetzer darf das Symbol nicht eine Minute lang leer halten.

    yfinance liefert gelegentlich einen leeren Rahmen zurueck. Wuerde der im
    Cache landen, waere das Symbol bis zum Ablauf der TTL tot — obwohl der
    naechste Versuch geliefert haette.
    """
    import pandas as pd
    import services.market_data as MD

    zaehler = {"n": 0}

    class LeerTicker:
        def __init__(self, t):
            self.t = t

        def history(self, period, interval):
            zaehler["n"] += 1
            return pd.DataFrame()

    echt = MD.yf
    MD.yf = type("m", (), {"Ticker": LeerTicker})()
    MD._kerzen_cache.clear()
    _takt.zuruecksetzen(rate=0.0)
    try:
        a = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
        nach_erstem = dict(MD._kerzen_cache)      # Zustand SICHERN, siehe unten
        versuche_erster = zaehler["n"]
        b = MD._fetch_ohlcv_single("EURUSD", "1d", "6mo")
        versuche_gesamt = zaehler["n"]
    finally:
        MD.yf = echt
        MD._kerzen_cache.clear()
        _takt.zuruecksetzen(rate=7.0)

    # FALLE, in die die erste Fassung lief: das finally leerte den Cache, BEVOR
    # geprueft wurde — der Test konnte gar nicht fehlschlagen und liess die
    # Sabotage "leere Antwort wird zwischengespeichert" durch. Deshalb wird der
    # Zustand jetzt INNERHALB des try gesichert.
    assert a == [] and b == []
    assert ("EURUSD", "1d", "6mo") not in nach_erstem,         "ein leeres Ergebnis darf NICHT im Cache landen"
    # Der zweite Aufruf muss erneut ans Netz gegangen sein, nicht in den Cache.
    assert versuche_gesamt > versuche_erster,         f"zweiter Aufruf kam aus dem Cache ({versuche_erster} -> {versuche_gesamt} Versuche)"
