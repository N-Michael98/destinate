"""
Event Bus — Zentraler Kommunikations-Layer
Alle Module publishen Events, alle Module können subscriben.
Kein direktes Importieren zwischen Modulen nötig.

Events:
  TRADE_OPENED       → trade_lifecycle_manager hört zu
  TRADE_CLOSED       → telegram_alerts + journal
  BREAKEVEN_SET      → telegram_alerts
  TRAILING_UPDATED   → intern
  DRAWDOWN_ALERT     → telegram_alerts + killswitch
  KILLSWITCH         → alle Module stoppen
  PRICE_UPDATE       → trade_lifecycle_manager
  ERROR              → telegram_alerts + logging
"""

import asyncio
import logging
from typing import Callable, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── Event Typen ───────────────────────────────────────────────────────────────

class EventType:
    TRADE_OPENED     = "TRADE_OPENED"
    TRADE_CLOSED     = "TRADE_CLOSED"
    BREAKEVEN_SET    = "BREAKEVEN_SET"
    TRAILING_UPDATED = "TRAILING_UPDATED"
    PARTIAL_TP       = "PARTIAL_TP"
    ZEIT_EXIT        = "ZEIT_EXIT"
    DRAWDOWN_ALERT   = "DRAWDOWN_ALERT"
    KILLSWITCH       = "KILLSWITCH"
    PRICE_UPDATE     = "PRICE_UPDATE"
    ERROR            = "ERROR"
    INFO             = "INFO"

# ── Event Objekt ──────────────────────────────────────────────────────────────

class Event:
    def __init__(self, event_type: str, data: dict, source: str = "system"):
        self.type      = event_type
        self.data      = data
        self.source    = source
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def __repr__(self):
        return f"Event({self.type}, source={self.source}, ts={self.timestamp})"

# ── Event Bus ─────────────────────────────────────────────────────────────────

class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}
        self._history: list[Event] = []
        self._max_history = 500
        self._killswitch_active = False

    def subscribe(self, event_type: str, handler: Callable) -> None:
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.debug(f"[event-bus] Subscribe: {handler.__name__} → {event_type}")

    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        if event_type in self._subscribers:
            self._subscribers[event_type] = [
                h for h in self._subscribers[event_type] if h != handler
            ]

    async def publish(self, event_type: str, data: dict, source: str = "system") -> None:
        event = Event(event_type, data, source)

        # Kill Switch sperrt alles ausser KILLSWITCH selbst
        if self._killswitch_active and event_type != EventType.KILLSWITCH:
            logger.warning(f"[event-bus] KILLSWITCH aktiv — Event blockiert: {event_type}")
            return

        # History speichern
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        logger.info(f"[event-bus] 📡 {event_type} | source={source} | data={data}")

        # Kill Switch aktivieren
        if event_type == EventType.KILLSWITCH:
            self._killswitch_active = True
            logger.critical("[event-bus] 🚨 KILLSWITCH AKTIVIERT — alle Events gesperrt")

        # Handler aufrufen
        handlers = self._subscribers.get(event_type, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                logger.error(f"[event-bus] ❌ Handler {handler.__name__} fehler: {e}")

    def publish_sync(self, event_type: str, data: dict, source: str = "system") -> None:
        """Synchrone Version für nicht-async Kontext."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.publish(event_type, data, source))
            else:
                loop.run_until_complete(self.publish(event_type, data, source))
        except Exception as e:
            logger.error(f"[event-bus] publish_sync Fehler: {e}")

    def reset_killswitch(self, password: str) -> bool:
        import os
        correct = os.environ.get("KILLSWITCH_PASSWORD", "")
        if password == correct and correct:
            self._killswitch_active = False
            logger.info("[event-bus] ✅ Killswitch deaktiviert")
            return True
        return False

    @property
    def killswitch_active(self) -> bool:
        return self._killswitch_active

    def get_history(self, event_type: str | None = None, limit: int = 50) -> list[dict]:
        events = self._history if not event_type else [
            e for e in self._history if e.type == event_type
        ]
        return [
            {"type": e.type, "source": e.source, "data": e.data, "timestamp": e.timestamp}
            for e in events[-limit:]
        ]

    def get_stats(self) -> dict:
        from collections import Counter
        counts = Counter(e.type for e in self._history)
        return {
            "total_events":       len(self._history),
            "killswitch_active":  self._killswitch_active,
            "subscribers":        {k: len(v) for k, v in self._subscribers.items()},
            "event_counts":       dict(counts),
        }

# ── Singleton ─────────────────────────────────────────────────────────────────

bus = EventBus()
