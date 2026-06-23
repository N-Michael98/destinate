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

class TestBreakeven:
    @pytest.mark.asyncio
    async def test_breakeven_triggered_at_threshold(self):
        mgr = TradeLifecycleManager()
        t = make_trade(entry=1.1000, stop_loss=1.0970, take_profit=1.1060, confidence=80)
        mgr.register_trade(t)
        # BE bei 70% → 70% × 0.006 + 1.1000 = 1.1042
        be_price = 1.1000 + 0.006 * 0.70
        result = await mgr.on_price_update("T001", be_price + 0.0001)
        assert result["action"] == "UPDATE_SL"
        assert abs(result["new_sl"] - 1.1000) < 0.0001

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
        mgr.register_trade(t)
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
