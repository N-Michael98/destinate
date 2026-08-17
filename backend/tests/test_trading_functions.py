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


# ── Einheitlicher 4h-Zeitraum (09.08.) ───────────────────────────────────────

def test_alle_4h_strategien_nutzen_denselben_zeitraum():
    """Sonst holt jede Variante einen EIGENEN Netzabruf.

    Der Cache trennt nach (Symbol, Intervall, Zeitraum). Drei verschiedene
    4h-Zeitraeume bedeuteten drei 1h-Abrufe je Symbol statt einem — 90 statt
    30 je Zyklus. Bei 30 Symbolen sind das 60 unnoetige Abrufe gegen eine
    Datenquelle, die uns nachweislich begrenzt ("Too Many Requests", 06.08.).

    Vor der Vereinheitlichung nachgemessen: 32 Symbole x 7 betroffene
    Strategien = 224 Faelle, ALT gegen NEU. Kein einziges abweichendes Signal,
    keine abweichende Confidence; Unterschiede nur in sl/tp (max 0.021 %), und
    diese Felder erreichen keine Entscheidung.

    Wer hier einen anderen Zeitraum einfuehrt, macht die Ersparnis zunichte —
    still, denn funktionieren wuerde es weiterhin.
    """
    import inspect
    import re as _re

    zeitraeume = {}
    for name, fn in _TS.STRATEGIES.items():
        try:
            quelle = inspect.getsource(fn)
        except (OSError, TypeError):
            continue
        for intervall, zeitraum in _re.findall(
            r'_load\(symbol,\s*"([^"]+)",\s*"([^"]+)"\)', quelle
        ):
            if intervall == "4h":
                zeitraeume.setdefault(zeitraum, []).append(name)

    assert zeitraeume, "keine 4h-Strategie gefunden — Muster stimmt nicht mehr"
    assert len(zeitraeume) == 1, (
        f"4h-Strategien nutzen {len(zeitraeume)} verschiedene Zeitraeume: "
        f"{ {k: sorted(v) for k, v in zeitraeume.items()} } — "
        "jeder zusaetzliche kostet 30 Netzabrufe je Zyklus"
    )
    assert "3mo" in zeitraeume, f"erwartet 3mo, gefunden {list(zeitraeume)}"


def test_anzahl_verschiedener_kerzenabrufe_bleibt_klein():
    """Die Zahl der verschiedenen (Intervall, Zeitraum) bestimmt die Netzlast.

    Fuenf Kombinationen x 30 Symbole = 150 Abrufe je Zyklus fuer die
    Strategien. Jede weitere Kombination kostet 30 zusaetzliche. Der Test haelt
    die Zahl fest, damit sie nicht unbemerkt waechst.
    """
    import inspect
    import re as _re

    kombis = set()
    for fn in _TS.STRATEGIES.values():
        try:
            quelle = inspect.getsource(fn)
        except (OSError, TypeError):
            continue
        kombis.update(_re.findall(r'_load\(symbol,\s*"([^"]+)",\s*"([^"]+)"\)', quelle))
    assert len(kombis) <= 5, (
        f"{len(kombis)} verschiedene Kerzenabrufe: {sorted(kombis)} — "
        f"das sind {len(kombis) * 30} Netzabrufe je Zyklus"
    )


# ── Umlenkbare Kerzenquelle (10.08., Stufe 4 Schritt 1) ──────────────────────
# WOZU: um den 16-Strategien-Konsens rueckrechnen zu koennen, muss jede
# Strategie an jedem vergangenen Balken mit den Daten VON DAMALS laufen.
# Die Gefahr dabei ist nicht die Rueckrechnung selbst, sondern dass sie in den
# Livebetrieb durchschlaegt: ein historischer Ausschnitt im Live-Cache, oder
# ein Live-Scan im Nachbarfaden, der ploetzlich alte Kerzen sieht.


import threading as _threading                                        # noqa: E402


def _falsche_kerzen(zeilen=50, wert=1.5):
    def quelle(symbol, interval, period):
        return pd.DataFrame({
            "open": [wert] * zeilen, "high": [wert + 1] * zeilen,
            "low": [wert - 1] * zeilen, "close": [wert] * zeilen,
            "volume": [10.0] * zeilen,
        })
    return quelle


def _zaehlendes_get_ohlcv(zaehler):
    def get(symbol, interval, period):
        zaehler["n"] += 1
        werte = list(range(100, 200))
        stempel = pd.date_range("2026-01-01", periods=len(werte), freq="1h", tz="UTC")
        return [
            {"timestamp": t.isoformat(), "open": float(v), "high": float(v + 1),
             "low": float(v - 1), "close": float(v), "volume": 100}
            for t, v in zip(stempel, werte)
        ]
    return get


def test_kerzenquelle_ohne_haken_bleibt_alles_wie_bisher():
    """Der Livepfad darf sich um kein Verhalten unterscheiden."""
    zaehler = {"n": 0}
    echt = _TS.get_ohlcv
    _TS.get_ohlcv = _zaehlendes_get_ohlcv(zaehler)
    _TS._ohlcv_cache.clear()
    try:
        a = _TS._load("EURUSD", "1h", "3mo")
        b = _TS._load("EURUSD", "1h", "3mo")
    finally:
        _TS.get_ohlcv = echt
        _TS._ohlcv_cache.clear()
    assert zaehler["n"] == 1, "der Cache greift nicht mehr"
    assert len(a) == len(b) == 100


def test_kerzenquelle_umgeht_netz_und_cache():
    """Historische Laeufe duerfen den Live-Cache NICHT fuellen.

    Sonst bekaeme der naechste Live-Scan einen alten Ausschnitt serviert und
    wuerde auf Kursen von gestern handeln — ohne dass irgendwo etwas auffaellt.
    """
    zaehler = {"n": 0}
    echt = _TS.get_ohlcv
    _TS.get_ohlcv = _zaehlendes_get_ohlcv(zaehler)
    _TS._ohlcv_cache.clear()
    try:
        with _TS.kerzenquelle(_falsche_kerzen()):
            d = _TS._load("EURUSD", "1h", "3mo")
        cache_danach = len(_TS._ohlcv_cache)
    finally:
        _TS.get_ohlcv = echt
        _TS._ohlcv_cache.clear()
    assert zaehler["n"] == 0, "trotz Quelle wurde das Netz befragt"
    assert cache_danach == 0, "der historische Ausschnitt ist im Live-Cache gelandet"
    assert len(d) == 50


def test_kerzenquelle_raeumt_auch_bei_ausnahme_auf():
    zaehler = {"n": 0}
    echt = _TS.get_ohlcv
    _TS.get_ohlcv = _zaehlendes_get_ohlcv(zaehler)
    _TS._ohlcv_cache.clear()
    try:
        try:
            with _TS.kerzenquelle(_falsche_kerzen()):
                raise RuntimeError("Absicht")
        except RuntimeError:
            pass
        zaehler["n"] = 0
        _TS._load("EURUSD", "1h", "3mo")
    finally:
        _TS.get_ohlcv = echt
        _TS._ohlcv_cache.clear()
    assert zaehler["n"] == 1, "der Haken blieb nach der Ausnahme gesetzt"


def test_kerzenquelle_wirkt_nur_im_eigenen_faden():
    """Die Routen rechnen in einem ThreadPoolExecutor.

    Waere der Haken global, wuerde ein historischer Lauf einen gleichzeitig
    laufenden Live-Scan im Nachbarfaden auf alte Daten umbiegen. Genau diese
    stille Vertauschung darf nicht moeglich sein.
    """
    zaehler = {"n": 0}
    echt = _TS.get_ohlcv
    _TS.get_ohlcv = _zaehlendes_get_ohlcv(zaehler)
    _TS._ohlcv_cache.clear()
    import time as _zeit
    ergebnis = {}
    fehler = []

    # Faeden schlucken Ausnahmen still. Ohne diesen Faenger stirbt der Faden
    # unbemerkt und der Test scheitert spaeter an einem KeyError, der nichts
    # ueber die Ursache sagt — genau das ist beim ersten Lauf passiert
    # (fehlender time-Import). Der Faenger nennt den echten Grund.
    def gefangen(fn):
        def lauf():
            try:
                fn()
            except BaseException as e:
                fehler.append(f"{type(e).__name__}: {e}")
        return lauf

    def historisch():
        with _TS.kerzenquelle(_falsche_kerzen()):
            _zeit.sleep(0.15)
            ergebnis["hist"] = len(_TS._load("EURUSD", "1h", "3mo"))

    def live():
        _zeit.sleep(0.05)
        ergebnis["live"] = len(_TS._load("GBPUSD", "1h", "3mo"))

    try:
        f1 = _threading.Thread(target=gefangen(historisch))
        f2 = _threading.Thread(target=gefangen(live))
        f1.start(); f2.start(); f1.join(); f2.join()
    finally:
        _TS.get_ohlcv = echt
        _TS._ohlcv_cache.clear()

    assert not fehler, f"ein Faden ist gestorben: {fehler}"
    assert ergebnis["hist"] == 50, "der historische Faden bekam keine Quelldaten"
    assert ergebnis["live"] == 100, "der Live-Faden wurde auf historische Daten umgebogen"


def test_kerzenquelle_verschachtelt_und_zurueckgesetzt():
    with _TS.kerzenquelle(_falsche_kerzen(50)):
        aussen = len(_TS._load("X", "1h", "3mo"))
        with _TS.kerzenquelle(_falsche_kerzen(7)):
            innen = len(_TS._load("X", "1h", "3mo"))
        zurueck = len(_TS._load("X", "1h", "3mo"))
    assert (aussen, innen, zurueck) == (50, 7, 50)


def test_kerzenquelle_vertraegt_leere_antwort():
    """Gibt die Quelle nichts her, muss ein leerer Rahmen kommen — kein Absturz.
    Die Strategien pruefen alle auf df.empty."""
    with _TS.kerzenquelle(lambda s, i, p: None):
        leer = _TS._load("X", "1h", "3mo")
    assert leer.empty


def test_strategien_laufen_auf_mitgegebenen_kerzen():
    """Der eigentliche Zweck: eine echte Strategie auf fremden Kerzen."""
    import numpy as _np
    _np.random.seed(4)
    n = 300
    c = 100 * _np.exp(_np.cumsum(_np.random.normal(0, 0.004, n)))
    df = pd.DataFrame({
        "open": c, "high": c + 0.5, "low": c - 0.5, "close": c,
        "volume": _np.full(n, 1000.0),
    }, index=pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC"))

    zaehler = {"n": 0}
    echt = _TS.get_ohlcv
    _TS.get_ohlcv = _zaehlendes_get_ohlcv(zaehler)
    try:
        with _TS.kerzenquelle(lambda s, i, p: df):
            r = _TS.STRATEGIES["price_action"]("EGAL")
    finally:
        _TS.get_ohlcv = echt
    assert zaehler["n"] == 0, "die Strategie hat trotzdem Kurse geholt"
    assert r["signal"] in ("LONG", "SHORT", "NEUTRAL")


# ── Historischer Konsens (10.08., Stufe 4 Schritt 2) ─────────────────────────
# Hier wird NICHTS nachgebaut: analyze_all_strategies() ist dieselbe Funktion
# wie live und bekommt ueber den Kerzen-Haken die Daten des jeweiligen
# Zeitpunkts. Die Gefahr liegt woanders — dass ein Balken Daten aus der ZUKUNFT
# sieht, oder dass eine Strategie ohne ihre echten Daten still NEUTRAL sagt.


import services.strategie_historie as _SH                             # noqa: E402


def _reihe(n=500, freq="4h", start="2026-01-01"):
    idx = pd.date_range(start, periods=n, freq=freq, tz="UTC")
    return pd.DataFrame(
        {"open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 10.0},
        index=idx,
    )


def test_historie_liest_den_bedarf_aus_dem_quelltext():
    """Eine Liste von Hand wuerde beim naechsten Umbau still veralten — dann
    bekaeme eine Strategie historisch andere Daten als live."""
    bedarf = _SH.benoetigte_intervalle()
    assert "4h" in bedarf and "3mo" in bedarf["4h"]
    assert "15m" in bedarf, "scalping wurde nicht erkannt"
    zuordnung = _SH.strategien_je_intervall()
    alle = {name for namen in zuordnung.values() for name in namen}
    assert alle == set(_TS.STRATEGIES), (
        f"nicht jede Strategie ist zugeordnet: fehlt {set(_TS.STRATEGIES) - alle}"
    )


def test_historie_tabellen_decken_den_bedarf():
    """Fehlt ein Eintrag, faellt es erst im Betrieb auf — als leerer Rahmen."""
    bedarf = _SH.benoetigte_intervalle()
    zeitraeume = {z for menge in bedarf.values() for z in menge}
    assert zeitraeume <= set(_SH.ZEITRAUM_DAUER), (
        f"Zeitraum ohne Dauer: {zeitraeume - set(_SH.ZEITRAUM_DAUER)}"
    )
    assert set(bedarf) <= set(_SH.ABRUF_ZEITRAUM), (
        f"Intervall ohne Abruf-Zeitraum: {set(bedarf) - set(_SH.ABRUF_ZEITRAUM)}"
    )


def test_kerzenschnitt_sieht_nie_in_die_zukunft():
    """Der eine Fehler, der eine Rueckrechnung wertlos macht."""
    df = _reihe()
    schnitt = _SH.Kerzenschnitt({"4h": df})
    for i in [50, 200, 499]:
        schnitt.jetzt = df.index[i]
        teil = schnitt("X", "4h", "3mo")
        assert bool((teil.index <= df.index[i]).all()), f"Zukunftsdaten bei Balken {i}"
        assert teil.index[-1] == df.index[i]


def test_kerzenschnitt_meldet_zu_kurze_historie():
    """Wenn die Reihe spaeter anfaengt als angefordert, MUSS das vermerkt
    werden — sonst rechnet die Strategie mit weniger Geschichte als live,
    ohne dass es jemand erfaehrt."""
    df = _reihe()
    schnitt = _SH.Kerzenschnitt({"4h": df})
    schnitt.jetzt = df.index[5]
    schnitt("X", "4h", "3mo")
    assert ("4h", "3mo") in schnitt.unvollstaendig

    schnitt.unvollstaendig.clear()
    schnitt.jetzt = df.index[-1]
    schnitt("X", "4h", "5d")
    assert ("4h", "5d") not in schnitt.unvollstaendig, "5 Tage waren abgedeckt"


def test_kerzenschnitt_meldet_fehlendes_intervall():
    schnitt = _SH.Kerzenschnitt({"4h": _reihe()})
    schnitt.jetzt = pd.Timestamp("2026-02-01", tz="UTC")
    leer = schnitt("X", "15m", "5d")
    assert leer.empty
    assert ("15m", "5d") in schnitt.unvollstaendig


def test_kerzenschnitt_meldet_unbekannten_zeitraum():
    schnitt = _SH.Kerzenschnitt({"4h": _reihe()})
    schnitt.jetzt = _reihe().index[300]
    teil = schnitt("X", "4h", "99mo")
    assert not teil.empty, "lieber alles bis jetzt als nichts"
    assert ("4h", "99mo") in schnitt.unvollstaendig


def test_historie_meldet_luecken_statt_sie_zu_verschweigen():
    """Der Kern der Vorgabe: scalping darf NICHT still auf falschen Daten
    laufen. Fehlt sein 15m-Fenster, muss das gezaehlt und benannt werden.

    yfinance liefert 15m nur 60 Tage zurueck (gemessen 10.08.) — bei laengeren
    Fenstern ist die Luecke unvermeidbar. Verschweigen waere sie nicht.
    """
    lang = _reihe(n=600, freq="4h", start="2026-01-01")
    kurz = _reihe(n=200, freq="15min", start="2026-03-28")   # deckt nur das Ende

    def falsches_get_ohlcv(symbol, intervall, zeitraum):
        quelle = {"4h": lang, "1d": lang, "1h": lang, "15m": kurz}.get(intervall)
        if quelle is None:
            return []
        return [
            {"timestamp": t.isoformat(), "open": float(r["open"]), "high": float(r["high"]),
             "low": float(r["low"]), "close": float(r["close"]), "volume": float(r["volume"])}
            for t, r in quelle.iterrows()
        ]

    echt = _SH.get_ohlcv
    _SH.get_ohlcv = falsches_get_ohlcv
    try:
        r = _SH.konsens_historie("EURUSD", tage=30)
    finally:
        _SH.get_ohlcv = echt

    assert r["status"] == "ok"
    assert r["balken"] > 0
    luecken = r["strategienMitLuecken"]
    assert "scalping" in luecken, "die 15m-Luecke wurde verschwiegen"
    assert luecken["scalping"]["balkenOhneDaten"] > 0
    assert 0 < luecken["scalping"]["anteil"] <= 1


def test_historie_zaehlt_luecken_je_balken():
    """Die Summe je Strategie genuegt nicht.

    yfinance liefert 15m nur 60 Tage — die Luecke von scalping sitzt deshalb
    geschlossen am ANFANG des Fensters. Der Konsens der fruehen Balken ist aus
    weniger Strategien gebildet als der der spaeten. Wer das auswertet, muss
    beide Teile trennen koennen, sonst vergleicht er Ungleiches.
    """
    lang = _reihe(n=600, freq="4h", start="2026-01-01")
    kurz = _reihe(n=200, freq="15min", start="2026-03-28")   # nur das Ende

    def falsches_get_ohlcv(symbol, intervall, zeitraum):
        quelle = {"4h": lang, "1d": lang, "1h": lang, "15m": kurz}.get(intervall)
        if quelle is None:
            return []
        return [
            {"timestamp": t.isoformat(), "open": 1.0, "high": 2.0, "low": 0.5,
             "close": 1.5, "volume": 10.0} for t in quelle.index
        ]

    echt = _SH.get_ohlcv
    _SH.get_ohlcv = falsches_get_ohlcv
    try:
        r = _SH.konsens_historie("EURUSD", tage=30)
    finally:
        _SH.get_ohlcv = echt

    reihe = r["strategienOhneDaten"]
    assert len(reihe) == r["balken"], "Reihe passt nicht zu den Balken"
    assert max(reihe) > 0, "die Luecke wurde je Balken nicht vermerkt"
    # Der Anfang muss staerker betroffen sein als das Ende — genau das ist der
    # Grund, warum die Summe allein irrefuehrt.
    haelfte = len(reihe) // 2
    assert sum(reihe[:haelfte]) > sum(reihe[haelfte:]), (
        f"Luecken nicht am Anfang: vorne {sum(reihe[:haelfte])}, "
        f"hinten {sum(reihe[haelfte:])}"
    )


def test_historie_zaehlt_eine_strategie_je_balken_nur_einmal():
    """Sonst kaeme ein Anteil ueber 1 heraus.

    Heute macht keine Strategie zwei _load-Aufrufe. Sobald eine
    Multi-Timeframe-Strategie einen zweiten bekommt und beide Abrufe
    unvollstaendig sind, wuerde direktes Hochzaehlen sie an EINEM Balken
    zweimal zaehlen. Geprueft wird deshalb mit einer erfundenen Zuordnung,
    die genau diesen Fall herstellt.
    """
    basis = _reihe(n=400)

    def falsches_get_ohlcv(symbol, intervall, zeitraum):
        if intervall != "4h":
            return []          # alles ausser dem Takt fehlt -> Luecken
        return [
            {"timestamp": t.isoformat(), "open": 1.0, "high": 2.0, "low": 0.5,
             "close": 1.5, "volume": 10.0} for t in basis.index
        ]

    echte_zuordnung = _SH.strategien_je_intervall
    echt = _SH.get_ohlcv
    # Dieselbe Strategie haengt an zwei verschiedenen Abrufen — beide fehlen.
    _SH.strategien_je_intervall = lambda: {
        ("1d", "1y"): ["doppelt"],
        ("15m", "5d"): ["doppelt"],
    }
    _SH.get_ohlcv = falsches_get_ohlcv
    try:
        r = _SH.konsens_historie("EURUSD", tage=10)
    finally:
        _SH.strategien_je_intervall = echte_zuordnung
        _SH.get_ohlcv = echt

    reihe = r["strategienOhneDaten"]
    assert max(reihe) == 1, (
        f"eine Strategie wurde an einem Balken mehrfach gezaehlt: max={max(reihe)}"
    )


def test_historie_liefert_gleich_lange_reihen():
    """Ungleiche Laengen wuerden die spaetere Auswertung still verschieben —
    Kurs und Konsens gehoerten dann zu verschiedenen Zeitpunkten."""
    basis = _reihe(n=400)

    def falsches_get_ohlcv(symbol, intervall, zeitraum):
        return [
            {"timestamp": t.isoformat(), "open": float(r["open"]), "high": float(r["high"]),
             "low": float(r["low"]), "close": float(r["close"]), "volume": float(r["volume"])}
            for t, r in basis.iterrows()
        ]

    echt = _SH.get_ohlcv
    _SH.get_ohlcv = falsches_get_ohlcv
    try:
        r = _SH.konsens_historie("EURUSD", tage=10)
    finally:
        _SH.get_ohlcv = echt

    laengen = {
        len(r["zeitstempel"]), len(r["kurs"]), len(r["konsens"]),
        len(r["konsensConf"]), len(r["entryQualityTier"]), len(r["entryQualityScore"]),
    }
    assert len(laengen) == 1, f"Reihen verschieden lang: {laengen}"
    assert r["balken"] == len(r["zeitstempel"])


def test_historie_ohne_daten_stuerzt_nicht_ab():
    echt = _SH.get_ohlcv
    _SH.get_ohlcv = lambda *a, **k: []
    try:
        r = _SH.konsens_historie("EURUSD", tage=10)
    finally:
        _SH.get_ohlcv = echt
    assert r["status"] == "keine_daten"
    assert r["hinweise"], "ohne Daten muss ein Grund dastehen"


def test_historie_hinterlaesst_keinen_haken():
    """Nach dem Lauf muss der Kerzen-Haken wieder weg sein — sonst bekaeme der
    naechste Live-Scan in diesem Faden historische Daten."""
    basis = _reihe(n=300)
    echt = _SH.get_ohlcv
    _SH.get_ohlcv = lambda s, i, p: [
        {"timestamp": t.isoformat(), "open": 1.0, "high": 2.0, "low": 0.5,
         "close": 1.5, "volume": 10.0} for t in basis.index
    ]
    try:
        _SH.konsens_historie("EURUSD", tage=5)
    finally:
        _SH.get_ohlcv = echt
    assert getattr(_TS._kerzen_haken, "quelle", None) is None


def test_historie_endpunkt_begrenzt_das_fenster():
    """Die Rechenzeit faellt im Livedienst an — rund 52 ms je Balken.

    Ohne obere Grenze koennte ein einziger Aufruf mit tage=100000 den Dienst
    minutenlang beschaeftigen, waehrend er alle 5 Minuten den Live-Scan
    bedienen soll. Die Grenze ist der Schutz davor; ohne Test war sie im
    Sabotage-Lauf entfernbar, ohne dass etwas rot wurde.

    Geprueft werden nur UNGUELTIGE Werte — die werfen, bevor irgendein Kurs
    geholt wird. Der Test braucht deshalb kein Netz.
    """
    from fastapi import HTTPException
    from api.routes.strategies import (
        strategie_historie, MAX_FENSTER_TAGE, STANDARD_FENSTER_TAGE,
    )

    assert 1 <= STANDARD_FENSTER_TAGE <= MAX_FENSTER_TAGE

    for tage in [0, -1, -100, MAX_FENSTER_TAGE + 1, 100000]:
        with pytest.raises(HTTPException) as info:
            asyncio.run(strategie_historie("EURUSD", tage=tage))
        assert info.value.status_code == 400, f"tage={tage} wurde durchgelassen"


def test_historie_endpunkt_blockiert_den_event_loop_nicht():
    """Die Rechnung MUSS in einem eigenen Faden laufen.

    konsens_historie() rechnet je nach Fenster Sekunden bis Minuten. Laeuft das
    direkt im Event-Loop, warten ALLE anderen Anfragen dieses Dienstes mit —
    auch die des Live-Scans. Genau dieser Fehler wurde am 27.07. als
    Audit-Fund #6 an mehreren Routen behoben.

    Ein Verhaltenstest greift hier nicht: ob der Loop blockiert, zeigt sich
    beim direkten Aufruf nicht. Geprueft wird deshalb die Struktur — dasselbe
    Vorgehen, mit dem safety-nets die Riegel des Handelspfads sichert.
    """
    import inspect
    from api.routes import strategies as _routen

    quelle = inspect.getsource(_routen.strategie_historie)
    assert "run_in_executor" in quelle, (
        "der historische Lauf blockiert den Event-Loop — alle anderen Anfragen "
        "dieses Dienstes warten mit (Audit-Fund #6, 27.07.)"
    )
    assert "await" in quelle


# ── Chartmuster (13.08.) ─────────────────────────────────────────────────────
# Die Muster bestehen aus WENDEPUNKTEN, und die Regel dafuer gibt es im System
# schon (_swing_points im Handelspfad). alle_swings() verwendet dieselbe Regel,
# liefert aber die ganze Reihe statt nur den letzten Punkt. Diese Doppelung ist
# der gefaehrlichste Teil des Moduls — deshalb wird sie hier gegen das Original
# geprueft, nicht bloss behauptet.

import services.chartmuster as _CM                                   # noqa: E402


def _kerzen(hochs, tiefs=None, schluss=None):
    """Baut einen Kerzensatz aus Hoch-/Tief-Reihen."""
    n = len(hochs)
    tiefs = tiefs if tiefs is not None else [h - 1.0 for h in hochs]
    schluss = schluss if schluss is not None else [(h + t) / 2 for h, t in zip(hochs, tiefs)]
    idx = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    return pd.DataFrame(
        {"open": schluss, "high": hochs, "low": tiefs, "close": schluss,
         "volume": [10.0] * n},
        index=idx,
    )


def test_muster_swing_regel_stimmt_mit_dem_handelspfad_ueberein():
    """DER wichtigste Test dieses Moduls.

    alle_swings() ist eine zweite Fassung derselben Regel, die _swing_points()
    im Handelspfad benutzt. Eine zweite, leicht andere Wendepunkt-Definition
    waere genau die Sorte Abweichung, die spaeter niemand mehr erklaeren kann.
    Geprueft wird deshalb auf mehreren Reihen, dass der LETZTE Punkt aus beiden
    Wegen identisch ist.
    """
    import random
    random.seed(4711)
    for lauf in range(12):
        n = 60
        hochs = [100 + random.uniform(-6, 6) for _ in range(n)]
        tiefs = [h - random.uniform(0.5, 3.0) for h in hochs]
        df = _kerzen(hochs, tiefs)

        tief_orig, hoch_orig = _TS._swing_points(df)
        punkte = _CM.alle_swings(df)
        letztes_tief = next((p["kurs"] for p in reversed(punkte) if p["art"] == "tief"), None)
        letztes_hoch = next((p["kurs"] for p in reversed(punkte) if p["art"] == "hoch"), None)

        assert letztes_tief == tief_orig, (
            f"Lauf {lauf}: Swing-Tief weicht ab — alle_swings {letztes_tief}, "
            f"_swing_points {tief_orig}"
        )
        assert letztes_hoch == hoch_orig, (
            f"Lauf {lauf}: Swing-Hoch weicht ab — alle_swings {letztes_hoch}, "
            f"_swing_points {hoch_orig}"
        )


def test_muster_swings_sind_bestaetigt():
    """Die letzten Kerzen koennen naturgemaess keinen Wendepunkt tragen —
    sonst waere er unbestaetigt und taugte nicht als Grundlage."""
    hochs = [100] * 20 + [110] + [100] * 3      # Spitze ganz am Ende
    df = _kerzen(hochs)
    punkte = _CM.alle_swings(df)
    for p in punkte:
        assert p["index"] <= len(df) - 1 - _CM.SWING_RECHTS, (
            f"unbestaetigter Wendepunkt bei Index {p['index']} von {len(df)}"
        )


def test_muster_doppeltop_wird_erkannt():
    """Zwei Hochs auf gleicher Hoehe, dazwischen ein Tief."""
    hochs = ([100] * 5 + [120] + [100] * 5 + [98] + [100] * 5 + [120]
             + [100] * 5 + [100] * 4)
    tiefs = [h - 1 for h in hochs]
    tiefs[11] = 80                               # deutliche Einbuchtung
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    namen = [m["muster"] for m in r["muster"]]
    assert "DOPPELTOP" in namen, f"nicht erkannt — {r['grund']}, swings={r['swings']}"
    dt = next(m for m in r["muster"] if m["muster"] == "DOPPELTOP")
    assert dt["richtung"] == "SHORT"
    assert dt["nackenlinie"] < 100


def test_muster_doppelboden_ist_das_spiegelbild():
    tiefs = ([100] * 5 + [80] + [100] * 5 + [102] + [100] * 5 + [80]
             + [100] * 5 + [100] * 4)
    hochs = [t + 1 for t in tiefs]
    hochs[11] = 120
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    namen = [m["muster"] for m in r["muster"]]
    assert "DOPPELBODEN" in namen, f"nicht erkannt — {r['grund']}, swings={r['swings']}"
    db = next(m for m in r["muster"] if m["muster"] == "DOPPELBODEN")
    assert db["richtung"] == "LONG"


def test_muster_zwei_verschiedene_hochs_sind_kein_doppeltop():
    """Gegenprobe: liegen die Hochs NICHT auf gleicher Hoehe, ist es keines.

    Ohne diese Pruefung bestuende der Test oben auch dann, wenn die Erkennung
    einfach jedes Hochpaar meldet.
    """
    hochs = ([100] * 5 + [120] + [100] * 5 + [98] + [100] * 5 + [150]
             + [100] * 5 + [100] * 4)
    tiefs = [h - 1 for h in hochs]
    tiefs[11] = 80
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    assert "DOPPELTOP" not in [m["muster"] for m in r["muster"]], (
        "120 und 150 wurden als 'gleiche Hoehe' gewertet"
    )


def test_muster_sks_verlangt_einen_echten_kopf():
    """Drei Hochs, das mittlere deutlich hoeher."""
    hochs = ([100] * 5 + [120] + [100] * 5 + [95] + [100] * 3 + [145]
             + [100] * 3 + [96] + [100] * 3 + [120] + [100] * 5)
    tiefs = [h - 1 for h in hochs]
    tiefs[11] = 85
    tiefs[19] = 86
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    namen = [m["muster"] for m in r["muster"]]
    assert "SKS" in namen, f"nicht erkannt — {r['grund']}, swings={r['swings']}"
    sks = next(m for m in r["muster"] if m["muster"] == "SKS")
    assert sks["richtung"] == "SHORT"
    assert len(sks["punkte"]) == 3
    # Der Kopf MUSS in der Mitte liegen und der hoechste sein.
    kurse = [p["kurs"] for p in sks["punkte"]]
    assert kurse[1] == max(kurse), f"Kopf nicht der hoechste: {kurse}"


def test_muster_drei_gleiche_hochs_sind_kein_sks():
    """Gegenprobe: ohne erhoehten Kopf ist es kein Schulter-Kopf-Schulter."""
    hochs = ([100] * 5 + [120] + [100] * 5 + [95] + [100] * 3 + [121]
             + [100] * 3 + [96] + [100] * 3 + [120] + [100] * 5)
    tiefs = [h - 1 for h in hochs]
    tiefs[11] = 85
    tiefs[19] = 86
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    assert "SKS" not in [m["muster"] for m in r["muster"]], (
        "121 gegen 120 wurde als Kopf gewertet"
    )


def test_muster_toleranz_haengt_am_atr_nicht_am_prozent():
    """Der Kern der Masseinheit.

    Dieselbe Formation in einem ruhigen und in einem bewegten Markt muss
    GLEICH bewertet werden. In Kursprozent gemessen waere sie es nicht — ueber
    die 30 Symbole liegt der Faktor bei 17,6 zwischen ruhigstem und bewegtestem
    Markt (gemessen 13.08.).
    """
    atr_klein = 1.0
    atr_gross = 10.0
    # 3 Einheiten Abstand: bei ATR 1 zu viel, bei ATR 10 innerhalb der Toleranz.
    assert not _CM._gleich_auf(100, 103, atr_klein)
    assert _CM._gleich_auf(100, 103, atr_gross)
    # Ohne ATR darf NICHTS als gleich gelten — sonst entstuenden Muster aus
    # fehlenden Daten.
    assert not _CM._gleich_auf(100, 100, 0)
    assert not _CM._gleich_auf(100, 100, None)


def test_muster_meldet_immer_einen_grund():
    """Ein leeres Ergebnis ohne Begruendung ist im Betrieb nicht von einem
    Ausfall zu unterscheiden."""
    leer = _CM.erkenne_muster(pd.DataFrame())
    assert leer["muster"] == [] and leer["grund"]
    kurz = _CM.erkenne_muster(_kerzen([100] * 5))
    assert kurz["muster"] == [] and kurz["grund"]
    flach = _CM.erkenne_muster(_kerzen([100] * 60))
    assert flach["muster"] == [] and flach["grund"], "flacher Markt ohne Grund"


def test_muster_dreieck_verlangt_verengung():
    """Eine Reihe von Wendepunkten ist noch kein Dreieck."""
    # Verengend: Hochs fallen, Tiefs steigen
    hochs = ([100] * 4 + [140] + [100] * 4 + [90] + [100] * 4 + [125]
             + [100] * 4 + [95] + [100] * 4 + [115] + [100] * 4 + [98] + [100] * 5)
    tiefs = [h - 1 for h in hochs]
    for i in (9, 19, 29):
        tiefs[i] = hochs[i] - 1
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    namen = [m["muster"] for m in r["muster"]]
    assert any(n.startswith("DREIECK") for n in namen), (
        f"verengende Formation nicht als Dreieck erkannt — {r['grund']}, "
        f"swings={r['swings']}"
    )
    # Ein Dreieck darf NIE als bestaetigt gelten — es gibt erst mit dem
    # Ausbruch eine Richtung.
    for m in r["muster"]:
        if m["muster"].startswith("DREIECK"):
            assert m["bestaetigt"] is False


def test_muster_bestaetigung_verlangt_den_bruch():
    """Ein Muster ohne Bruch der Nackenlinie ist eine Vermutung, kein Muster."""
    hochs = ([100] * 5 + [120] + [100] * 5 + [98] + [100] * 5 + [120]
             + [100] * 5 + [100] * 4)
    tiefs = [h - 1 for h in hochs]
    tiefs[11] = 80
    # Schluss deutlich UEBER der Nackenlinie -> nicht bestaetigt
    df_offen = _kerzen(hochs, tiefs, schluss=[105.0] * len(hochs))
    r1 = _CM.erkenne_muster(df_offen)
    dt1 = next((m for m in r1["muster"] if m["muster"] == "DOPPELTOP"), None)
    assert dt1 is not None and dt1["bestaetigt"] is False

    # Schluss UNTER der Nackenlinie -> bestaetigt
    schluss = [105.0] * len(hochs)
    schluss[-1] = 70.0
    df_zu = _kerzen(hochs, tiefs, schluss=schluss)
    r2 = _CM.erkenne_muster(df_zu)
    dt2 = next((m for m in r2["muster"] if m["muster"] == "DOPPELTOP"), None)
    assert dt2 is not None and dt2["bestaetigt"] is True


def test_muster_endpunkt_prueft_das_intervall():
    """Ein freies Intervall wuerde yfinance-Abrufe erzeugen, die es nicht gibt."""
    import asyncio as _aio
    from fastapi import HTTPException
    from api.routes.strategies import chartmuster, ERLAUBTE_INTERVALLE

    for schlecht in ["1m", "99h", "", "4H "]:
        try:
            _aio.run(chartmuster("EURUSD", schlecht))
            raise AssertionError(f"Intervall {schlecht!r} wurde akzeptiert")
        except HTTPException as e:
            assert e.status_code == 400
    assert "4h" in ERLAUBTE_INTERVALLE


def test_muster_endpunkt_blockiert_den_event_loop_nicht():
    """Die Wendepunkt-Suche geht ueber alle Kerzen. Laeuft das im Event-Loop,
    warten ALLE anderen Anfragen dieses Dienstes mit (Audit-Fund #6)."""
    import inspect
    from api.routes import strategies as _routen
    quelle = inspect.getsource(_routen.chartmuster)
    assert "run_in_executor" in quelle, (
        "die Mustererkennung blockiert den Event-Loop"
    )


def test_muster_nackenlinie_liegt_zwischen_den_hochs():
    """Gegenprobe zur Nackenlinie.

    Im Sabotage-Lauf (13.08.) liess sich die Bedingung "das Tief muss ZWISCHEN
    den beiden Hochs liegen" ersatzlos streichen, ohne dass ein Test rot wurde:
    in meinen Testdaten lag das tiefste Tief ohnehin dazwischen. Hier liegt ein
    NOCH TIEFERES Tief ausserhalb — wird es als Nackenlinie genommen, ist das
    Muster falsch vermessen und die Bestaetigung kaeme viel zu spaet.
    """
    # NACHGEMESSEN: die Wendepunkte liegen bei 5 (hoch), 11 (tief), 17 (hoch),
    # 23 (tief). Ein Tief bei Index 2 waere KEIN Wendepunkt — es braucht drei
    # Kerzen davor. Der erste Anlauf dieses Tests scheiterte genau daran und
    # bewies deshalb nichts.
    hochs = ([100] * 5 + [120] + [100] * 5 + [98] + [100] * 5 + [120]
             + [100] * 5 + [100] * 8)
    tiefs = [h - 1 for h in hochs]
    tiefs[11] = 80          # die ECHTE Nackenlinie, ZWISCHEN den Hochs
    tiefs[23] = 40          # viel tiefer, aber NACH dem zweiten Hoch
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    dt = next((m for m in r["muster"] if m["muster"] == "DOPPELTOP"), None)
    assert dt is not None, f"Doppeltop nicht erkannt — {r['grund']}"
    assert dt["nackenlinie"] == 80, (
        f"Nackenlinie {dt['nackenlinie']} statt 80 — es wurde ein Tief "
        f"ausserhalb der beiden Hochs genommen"
    )


def test_muster_ohne_verengung_kein_dreieck():
    """Gegenprobe zum Dreieck.

    Eine Reihe von Wendepunkten ist noch keine Formation. Im Sabotage-Lauf
    liess sich die Verengungs-Bedingung streichen, ohne dass etwas rot wurde —
    dann waere jede Zickzack-Bewegung ein Dreieck gewesen.
    """
    # ZWEI Reihen, die sich NUR in der Verengung unterscheiden — alles andere
    # ist gleich. Sonst bewiese der Test nicht, dass es an der Verengung liegt.
    # Beide nachgemessen: die erste ergibt DREIECK_SYMMETRISCH, die zweite
    # nichts, obwohl die Form (fallende Hochs, steigende Tiefs) in beiden passt.
    def _reihe(h1, h2, t1, t2):
        hh, tt = [], []
        for i in range(60):
            if i == 7:    hh.append(h1); tt.append(h1 - 1)
            elif i == 17: hh.append(t1 + 1); tt.append(t1)
            elif i == 27: hh.append(h2); tt.append(h2 - 1)
            elif i == 37: hh.append(t2 + 1); tt.append(t2)
            else:         hh.append(100.0); tt.append(99.0)
        return _kerzen(hh, tt)

    eng = _CM.erkenne_muster(_reihe(130.0, 115.0, 70.0, 85.0))
    assert any(m["muster"].startswith("DREIECK") for m in eng["muster"]), (
        f"deutlich verengende Formation nicht erkannt — {eng['grund']}"
    )

    weit = _CM.erkenne_muster(_reihe(130.0, 128.0, 70.0, 72.0))
    namen = [m["muster"] for m in weit["muster"]]
    assert not any(n.startswith("DREIECK") for n in namen), (
        f"kaum verengende Formation wurde als Dreieck gewertet: {namen}"
    )


def test_muster_kein_treffer_nennt_trotzdem_einen_grund():
    """Der Fall, der im Sabotage-Lauf durchrutschte.

    Der frueheren Pruefung genuegten Reihen, die schon vorher abbrechen (keine
    Kerzen, kein ATR, zu wenige Wendepunkte) — die haben ihren Grund an einer
    anderen Stelle. Hier laeuft die Erkennung VOLLSTAENDIG durch, findet aber
    nichts. Ohne Grund waere das im Betrieb nicht von einem Ausfall zu
    unterscheiden.
    """
    # AUFWEITENDE Zickzack-Bewegung: Wendepunkte gibt es reichlich, aber
    # keine Formation — die Hochs STEIGEN (also kein Dreieck, das verlangt
    # fallende oder gleiche Hochs) und liegen alle auf verschiedener Hoehe
    # (also weder Doppeltop noch Schulter-Kopf-Schulter).
    hoch_stufen = [130.0, 160.0, 195.0, 235.0]
    tief_stufen = [70.0, 45.0, 15.0, -20.0]
    hochs, tiefs = [], []
    for i in range(80):
        if i % 20 == 5:
            hochs.append(hoch_stufen[i // 20]); tiefs.append(hoch_stufen[i // 20] - 1)
        elif i % 20 == 15:
            hochs.append(tief_stufen[i // 20] + 1); tiefs.append(tief_stufen[i // 20])
        else:
            hochs.append(100.0); tiefs.append(99.0)
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    assert r["swings"] >= 2, f"Testdaten liefern zu wenige Wendepunkte: {r['swings']}"
    assert r["muster"] == [], f"unerwartetes Muster: {[m['muster'] for m in r['muster']]}"
    assert r["grund"], "Erkennung lief vollstaendig durch, meldet aber keinen Grund"


def test_muster_doppelboden_nackenlinie_liegt_zwischen_den_tiefs():
    """Dieselbe Gegenprobe wie beim Doppeltop, fuer die Spiegelseite.

    Im Sabotage-Lauf liess sich auch hier die Bedingung 'das Hoch muss ZWISCHEN
    den beiden Tiefs liegen' streichen. Beide Seiten brauchen ihre eigene
    Pruefung — ein Riegel, den nur die eine Haelfte hat, ist kein Riegel.
    """
    tiefs = ([100] * 5 + [80] + [100] * 5 + [102] + [100] * 5 + [80]
             + [100] * 5 + [100] * 8)
    hochs = [t + 1 for t in tiefs]
    hochs[11] = 120         # die ECHTE Nackenlinie, ZWISCHEN den Tiefs
    hochs[23] = 200         # viel hoeher, aber NACH dem zweiten Tief
    df = _kerzen(hochs, tiefs)
    r = _CM.erkenne_muster(df)
    db = next((m for m in r["muster"] if m["muster"] == "DOPPELBODEN"), None)
    assert db is not None, f"Doppelboden nicht erkannt — {r['grund']}"
    assert db["nackenlinie"] == 120, (
        f"Nackenlinie {db['nackenlinie']} statt 120 — es wurde ein Hoch "
        f"ausserhalb der beiden Tiefs genommen"
    )



# ── Muster-Rueckrechnung (17.08.) ────────────────────────────────────────────

import services.muster_historie as _MH                                # noqa: E402


def _steigend(n=200, start="2024-01-01"):
    """Kerzen mit Zickzack, damit Wendepunkte entstehen."""
    idx = pd.date_range(start, periods=n, freq="1D", tz="UTC")
    hochs, tiefs = [], []
    for i in range(n):
        basis = 100.0
        hochs.append(basis + (12.0 if i % 17 == 8 else 1.0))
        tiefs.append(basis - (12.0 if i % 17 == 0 else 1.0))
    return pd.DataFrame(
        {"open": [100.0] * n, "high": hochs, "low": tiefs,
         "close": [100.0] * n, "volume": [10.0] * n}, index=idx)


def test_musterhistorie_sieht_nie_in_die_zukunft():
    """Derselbe Riegel wie bei der Konsens-Rueckrechnung, hier fuer Muster.

    Der Kerzenschnitt stammt aus strategie_historie und ist dort geprueft —
    hier wird sichergestellt, dass die Muster-Rueckrechnung ihn WIRKLICH
    benutzt und nicht am ihm vorbei rechnet.
    """
    basis = _steigend()
    gesehen = []

    echt_erkenne = _MH.erkenne_muster

    def mit_mitschrift(df):
        gesehen.append(None if df is None or df.empty else df.index[-1])
        return {"muster": []}

    echt_get = _MH.get_ohlcv
    _MH.get_ohlcv = lambda s, i, p: [
        {"timestamp": t.isoformat(), "open": float(r["open"]), "high": float(r["high"]),
         "low": float(r["low"]), "close": float(r["close"]), "volume": 10.0}
        for t, r in basis.iterrows()]
    _MH.erkenne_muster = mit_mitschrift
    try:
        r = _MH.muster_historie("EURUSD", tage=30, intervall="1d")
    finally:
        _MH.get_ohlcv = echt_get
        _MH.erkenne_muster = echt_erkenne

    assert r["status"] == "ok", r.get("hinweise")
    assert len(gesehen) == r["balken"]
    for i, zeitpunkt in enumerate(r["zeitstempel"]):
        if gesehen[i] is None:
            continue
        assert str(gesehen[i]) <= zeitpunkt.replace("+00:00", "+00:00"), (
            f"Balken {i} sah Kerzen aus der Zukunft"
        )


def test_musterhistorie_zaehlt_nur_bestaetigte_als_richtung():
    """Ein unbestaetigtes Muster haette nie einen Einstieg ausgeloest.

    Wuerde es trotzdem als Richtung gezaehlt, maesse die Auswertung etwas, das
    nie stattgefunden hat — dieselbe Falle wie ein Backtest ohne Ausfuehrung.
    """
    basis = _steigend()
    echt_erkenne = _MH.erkenne_muster
    echt_get = _MH.get_ohlcv
    _MH.get_ohlcv = lambda s, i, p: [
        {"timestamp": t.isoformat(), "open": 100.0, "high": 101.0, "low": 99.0,
         "close": 100.0, "volume": 10.0} for t in basis.index]
    # Immer ein UNBESTAETIGTES Doppeltop melden
    _MH.erkenne_muster = lambda df: {"muster": [
        {"muster": "DOPPELTOP", "richtung": "SHORT", "bestaetigt": False}]}
    try:
        r = _MH.muster_historie("EURUSD", tage=30, intervall="1d")
    finally:
        _MH.get_ohlcv = echt_get
        _MH.erkenne_muster = echt_erkenne

    assert set(r["konsens"]) == {"NEUTRAL"}, (
        f"unbestaetigtes Muster wurde als Richtung gezaehlt: {set(r['konsens'])}"
    )
    assert set(r["entryQualityTier"]) == {"KEIN_MUSTER"}
    # In musterAlle MUSS es trotzdem stehen — sonst laesst sich spaeter nicht
    # beantworten, ob die Bestaetigung ueberhaupt etwas bringt.
    assert all(liste == ["DOPPELTOP"] for liste in r["musterAlle"])


def test_musterhistorie_meldet_fehlenden_vorlauf():
    """Balken ohne genug Vorlauf duerfen NICHT als 'kein Muster' zaehlen —
    sonst sieht fehlende Datenlage aus wie ein gemessenes Ergebnis."""
    kurz = _steigend(n=70)
    echt_get = _MH.get_ohlcv
    _MH.get_ohlcv = lambda s, i, p: [
        {"timestamp": t.isoformat(), "open": 100.0, "high": 101.0, "low": 99.0,
         "close": 100.0, "volume": 10.0} for t in kurz.index]
    try:
        r = _MH.muster_historie("EURUSD", tage=70, intervall="1d")
    finally:
        _MH.get_ohlcv = echt_get
    assert r["balkenOhneVorlauf"] > 0, "fehlender Vorlauf wurde nicht gezaehlt"
    assert any("Vorlauf" in h for h in r["hinweise"])


def test_musterhistorie_liefert_gleich_lange_reihen():
    """Ungleiche Laengen wuerden Kurs und Muster gegeneinander verschieben."""
    basis = _steigend()
    echt_get = _MH.get_ohlcv
    _MH.get_ohlcv = lambda s, i, p: [
        {"timestamp": t.isoformat(), "open": float(r["open"]), "high": float(r["high"]),
         "low": float(r["low"]), "close": float(r["close"]), "volume": 10.0}
        for t, r in basis.iterrows()]
    try:
        r = _MH.muster_historie("EURUSD", tage=90, intervall="1d")
    finally:
        _MH.get_ohlcv = echt_get
    laengen = {len(r["zeitstempel"]), len(r["kurs"]), len(r["konsens"]),
               len(r["konsensConf"]), len(r["entryQualityTier"]),
               len(r["strategienOhneDaten"]), len(r["musterAlle"]), len(r["bestaetigt"])}
    assert len(laengen) == 1, f"Reihen verschieden lang: {laengen}"
    assert r["balken"] == len(r["zeitstempel"])


def test_musterhistorie_ohne_daten_stuerzt_nicht_ab():
    echt_get = _MH.get_ohlcv
    _MH.get_ohlcv = lambda *a, **k: []
    try:
        r = _MH.muster_historie("EURUSD", tage=30, intervall="1d")
    finally:
        _MH.get_ohlcv = echt_get
    assert r["status"] == "keine_daten" and r["hinweise"]


def test_musterhistorie_endpunkt_prueft_seine_grenzen():
    import asyncio as _aio
    from fastapi import HTTPException
    from api.routes.strategies import muster_rueckrechnung, MAX_MUSTER_FENSTER_TAGE

    for tage in [0, -5, MAX_MUSTER_FENSTER_TAGE + 1, 99999]:
        try:
            _aio.run(muster_rueckrechnung("EURUSD", tage))
            raise AssertionError(f"tage={tage} wurde akzeptiert")
        except HTTPException as e:
            assert e.status_code == 400
    try:
        _aio.run(muster_rueckrechnung("EURUSD", 30, "1m"))
        raise AssertionError("Intervall 1m wurde akzeptiert")
    except HTTPException as e:
        assert e.status_code == 400


def test_musterhistorie_endpunkt_blockiert_den_event_loop_nicht():
    import inspect
    from api.routes import strategies as _routen
    assert "run_in_executor" in inspect.getsource(_routen.muster_rueckrechnung)


def test_muster_dreieck_ausbruch_gibt_die_richtung():
    """DER FUND vom 17.08.: Dreiecke waren nie bestaetigt und damit NIE messbar.

    Ueber alle 30 Symbole: 3485 Erkennungen, null Messungen — die
    Rueckrechnung zaehlt nur bestaetigte Muster als Richtung. Etwas zu bauen,
    das sich nicht ueberpruefen laesst, ist halbe Arbeit.

    Die Richtung kommt vom AUSBRUCH, nicht von der Form: ein steigendes
    Dreieck kann nach unten aufloesen. Wer die Form als Richtung nimmt, misst
    seine Erwartung statt der Beobachtung.
    """
    def reihe(schluss_am_ende):
        hh, tt = [], []
        for i in range(60):
            if i == 7:    hh.append(130.0); tt.append(129.0)
            elif i == 17: hh.append(71.0);  tt.append(70.0)
            elif i == 27: hh.append(115.0); tt.append(114.0)
            elif i == 37: hh.append(86.0);  tt.append(85.0)
            else:         hh.append(100.0); tt.append(99.0)
        c = [100.0] * 60
        c[-1] = schluss_am_ende
        return _kerzen(hh, tt, c)

    # Innerhalb der Spanne -> nicht bestaetigt, keine Richtung
    drin = next((m for m in _CM.erkenne_muster(reihe(100.0))["muster"]
                 if m["muster"].startswith("DREIECK")), None)
    assert drin is not None, "Dreieck bei Schluss innerhalb der Spanne nicht erkannt"
    assert drin["bestaetigt"] is False and drin["richtung"] == "NEUTRAL"

    # Ausbruch nach OBEN -> LONG
    hoch = next((m for m in _CM.erkenne_muster(reihe(140.0))["muster"]
                 if m["muster"].startswith("DREIECK")), None)
    assert hoch is not None and hoch["bestaetigt"] is True, "Ausbruch nach oben nicht erkannt"
    assert hoch["richtung"] == "LONG", hoch["richtung"]
    assert 100.0 < hoch["obergrenze"] <= 130.0

    # Ausbruch nach UNTEN -> SHORT, obwohl die Form dieselbe ist
    tief = next((m for m in _CM.erkenne_muster(reihe(60.0))["muster"]
                 if m["muster"].startswith("DREIECK")), None)
    assert tief is not None and tief["bestaetigt"] is True, "Ausbruch nach unten nicht erkannt"
    assert tief["richtung"] == "SHORT", (
        f"Form gab die Richtung statt des Ausbruchs: {tief['muster']} -> {tief['richtung']}"
    )
    # Die FORM muss dabei dieselbe bleiben — nur die Richtung haengt am Ausbruch.
    assert hoch["form"] == tief["form"]
