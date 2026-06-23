"""
Trade Lifecycle Manager
Überwacht jeden Trade von Entry bis Exit.
Wird vom Next.js Backend per HTTP informiert.
Publiziert Events für Breakeven, Trailing, Partial TP, Zeit-Exit, Drawdown.

Lifecycle:
  OPENED → [Partial TP] → [Breakeven] → [Trailing SL] → [Zeit-Exit / TP / SL] → CLOSED
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from core.event_bus import bus, EventType
from services.market_mapper import get_pip_size, get_instrument_info

logger = logging.getLogger(__name__)

# ── Konfidenz-Level → BE/Trail Schwellen ─────────────────────────────────────

def get_level(confidence: int) -> dict:
    if confidence >= 80:
        return {"be_at": 0.70, "trail_dist": 0.40, "partial_at": 0.50}
    if confidence >= 75:
        return {"be_at": 0.55, "trail_dist": 0.50, "partial_at": 0.50}
    return         {"be_at": 0.40, "trail_dist": 0.60, "partial_at": 0.50}

# ── Zeit-Exit Limits ──────────────────────────────────────────────────────────

STYLE_MAX_HOURS = {
    "SCALPING":   4,
    "DAYTRADING": 24,
    "SWING":      168,
}

# ── Default SL Range (falls kein SL gesetzt) ─────────────────────────────────

DEFAULT_SL_RANGE = {
    "EURUSD": 0.003, "GBPUSD": 0.003, "USDJPY": 0.3,  "AUDUSD": 0.003,
    "USDCAD": 0.003, "USDCHF": 0.003, "GBPJPY": 0.3,  "EURJPY": 0.3,
    "EURGBP": 0.003, "NZDUSD": 0.003,
    "XAUUSD": 10,    "XAGUSD": 0.5,
    "USOIL":  1.0,   "BRENT":  1.0,
    "US500":  20,    "NAS100": 50,    "UK100":  30,    "GER40":  40,
}

# ── Trade State ───────────────────────────────────────────────────────────────

class TradeState:
    def __init__(
        self,
        trade_id: str,
        symbol: str,
        direction: str,
        entry: float,
        stop_loss: float,
        take_profit: float,
        size: float,
        confidence: int,
        trading_style: str,
        broker: str,
        opened_at: Optional[datetime] = None,
    ):
        self.trade_id      = trade_id
        self.symbol        = symbol
        self.direction     = direction
        self.entry         = entry
        self.stop_loss     = stop_loss
        self.take_profit   = take_profit
        self.size          = size
        self.confidence    = confidence
        self.trading_style = trading_style.upper()
        self.broker        = broker
        self.opened_at     = opened_at or datetime.now(timezone.utc)

        # State Flags
        self.be_set        = False
        self.partial_done  = False
        self.trail_sl      = stop_loss if stop_loss > 0 else None
        self.current_sl    = stop_loss
        self.current_tp    = take_profit

    @property
    def age_hours(self) -> float:
        return (datetime.now(timezone.utc) - self.opened_at).total_seconds() / 3600

    @property
    def sl_range(self) -> float:
        if self.stop_loss > 0:
            return abs(self.entry - self.stop_loss)
        return DEFAULT_SL_RANGE.get(self.symbol, 0.005)

    @property
    def total_range(self) -> float:
        if self.take_profit > 0:
            return abs(self.take_profit - self.entry)
        return self.sl_range * 2

    def progress(self, current_price: float) -> float:
        if self.total_range <= 0:
            return 0.0
        if self.direction == "BUY":
            return (current_price - self.entry) / self.total_range
        return (self.entry - current_price) / self.total_range

    def is_buy(self) -> bool:
        return self.direction == "BUY"

    def to_dict(self) -> dict:
        return {
            "trade_id":      self.trade_id,
            "symbol":        self.symbol,
            "direction":     self.direction,
            "entry":         self.entry,
            "stop_loss":     self.current_sl,
            "take_profit":   self.current_tp,
            "size":          self.size,
            "confidence":    self.confidence,
            "trading_style": self.trading_style,
            "broker":        self.broker,
            "age_hours":     round(self.age_hours, 2),
            "be_set":        self.be_set,
            "partial_done":  self.partial_done,
            "trail_sl":      self.trail_sl,
        }

# ── Lifecycle Manager ─────────────────────────────────────────────────────────

class TradeLifecycleManager:
    def __init__(self):
        self._trades: dict[str, TradeState] = {}
        self._start_balance: float = 0
        self._current_balance: float = 0
        self._max_drawdown_pct: float = 10.0

    def set_balance(self, balance: float) -> None:
        if self._start_balance == 0:
            self._start_balance = balance
        self._current_balance = balance
        self._check_drawdown()

    def _check_drawdown(self) -> None:
        if self._start_balance <= 0:
            return
        drawdown = (self._start_balance - self._current_balance) / self._start_balance * 100
        if drawdown >= self._max_drawdown_pct:
            bus.publish_sync(EventType.DRAWDOWN_ALERT, {
                "start_balance":   self._start_balance,
                "current_balance": self._current_balance,
                "drawdown_pct":    round(drawdown, 2),
            }, source="lifecycle_manager")

    # ── Trade registrieren ────────────────────────────────────────────────────

    def register_trade(self, trade: TradeState) -> None:
        self._trades[trade.trade_id] = trade
        logger.info(f"[lifecycle] ✅ Trade registriert: {trade.trade_id} {trade.symbol} {trade.direction}")
        bus.publish_sync(EventType.TRADE_OPENED, {
            **trade.to_dict(),
        }, source="lifecycle_manager")

    def remove_trade(self, trade_id: str, pnl: float = 0, reason: str = "CLOSED") -> None:
        trade = self._trades.pop(trade_id, None)
        if trade:
            logger.info(f"[lifecycle] 🔒 Trade geschlossen: {trade_id} pnl={pnl}")
            bus.publish_sync(EventType.TRADE_CLOSED, {
                "trade_id": trade_id,
                "symbol":   trade.symbol,
                "broker":   trade.broker,
                "pnl":      pnl,
                "reason":   reason,
            }, source="lifecycle_manager")

    # ── Preis-Update verarbeiten ──────────────────────────────────────────────

    async def on_price_update(self, trade_id: str, current_price: float) -> dict:
        """
        Wird aufgerufen wenn ein neuer Preis verfügbar ist.
        Prüft: Zeit-Exit → Partial TP → Breakeven → Trailing SL
        Gibt zurück welche Aktionen ausgeführt werden sollen.
        """
        trade = self._trades.get(trade_id)
        if not trade:
            return {"action": None}

        lvl      = get_level(trade.confidence)
        progress = trade.progress(current_price)
        max_h    = STYLE_MAX_HOURS.get(trade.trading_style, 24)

        # 1. Zeit-Exit
        if trade.age_hours >= max_h:
            await bus.publish(EventType.ZEIT_EXIT, {
                "trade_id":     trade_id,
                "symbol":       trade.symbol,
                "trading_style": trade.trading_style,
                "age_hours":    trade.age_hours,
                "broker":       trade.broker,
                "pnl":          0,
            }, source="lifecycle_manager")
            return {"action": "CLOSE", "reason": "ZEIT_EXIT"}

        # 2. Partial TP (50% bei 50% Progress)
        if not trade.partial_done and progress >= lvl["partial_at"]:
            trade.partial_done = True
            partial_vol = trade.size / 2
            await bus.publish(EventType.PARTIAL_TP, {
                "trade_id":         trade_id,
                "symbol":           trade.symbol,
                "closed_volume":    partial_vol,
                "remaining_volume": partial_vol,
                "pnl":              0,
                "broker":           trade.broker,
            }, source="lifecycle_manager")
            return {"action": "PARTIAL_CLOSE", "volume": partial_vol}

        # 3. Breakeven
        already_at_be = (
            (trade.is_buy()  and trade.current_sl >= trade.entry - 0.0001) or
            (not trade.is_buy() and trade.current_sl <= trade.entry + 0.0001)
        ) if trade.current_sl > 0 else False

        if not trade.be_set and not already_at_be and progress >= lvl["be_at"]:
            trade.be_set   = True
            trade.trail_sl = trade.entry
            trade.current_sl = trade.entry
            await bus.publish(EventType.BREAKEVEN_SET, {
                "trade_id": trade_id,
                "symbol":   trade.symbol,
                "entry":    trade.entry,
                "broker":   trade.broker,
            }, source="lifecycle_manager")
            return {"action": "UPDATE_SL", "new_sl": trade.entry}

        # 4. Trailing SL (nur nach BE)
        if trade.be_set or already_at_be:
            trail_dist  = trade.sl_range * lvl["trail_dist"]
            new_trail   = (current_price - trail_dist) if trade.is_buy() else (current_price + trail_dist)
            current_trail = trade.trail_sl or trade.current_sl

            should_update = (
                trade.is_buy()  and new_trail > current_trail and new_trail >= trade.entry
            ) or (
                not trade.is_buy() and new_trail < current_trail and new_trail <= trade.entry
            )

            if should_update:
                trade.trail_sl   = new_trail
                trade.current_sl = new_trail
                await bus.publish(EventType.TRAILING_UPDATED, {
                    "trade_id": trade_id,
                    "symbol":   trade.symbol,
                    "new_sl":   new_trail,
                    "price":    current_price,
                    "broker":   trade.broker,
                }, source="lifecycle_manager")
                return {"action": "UPDATE_SL", "new_sl": new_trail}

        return {"action": None, "progress": round(progress, 3)}

    # ── Status ────────────────────────────────────────────────────────────────

    def get_all_trades(self) -> list[dict]:
        return [t.to_dict() for t in self._trades.values()]

    def get_trade(self, trade_id: str) -> Optional[dict]:
        t = self._trades.get(trade_id)
        return t.to_dict() if t else None

    def get_stats(self) -> dict:
        return {
            "open_trades":    len(self._trades),
            "start_balance":  self._start_balance,
            "current_balance": self._current_balance,
            "max_drawdown_pct": self._max_drawdown_pct,
        }

# ── Singleton ─────────────────────────────────────────────────────────────────

lifecycle = TradeLifecycleManager()
