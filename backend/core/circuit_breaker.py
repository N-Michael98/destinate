"""
Circuit Breaker — pybreaker
Schützt vor API-Spam bei Ausfällen.
Wenn ein API X-mal hintereinander fehlschlägt → Circuit öffnet sich → keine weiteren Calls.
Nach Timeout → Circuit halbgeöffnet → testet erneut.
"""

import logging
import pybreaker
from datetime import datetime

logger = logging.getLogger(__name__)


class TradingCircuitBreakerListener(pybreaker.CircuitBreakerListener):
    """Loggt alle Circuit Breaker State Changes."""

    def state_change(self, cb, old_state, new_state):
        logger.warning(
            f"[circuit-breaker] {cb.name}: {old_state.name} → {new_state.name}"
        )

    def failure(self, cb, exc):
        logger.error(f"[circuit-breaker] {cb.name} Fehler: {exc}")

    def success(self, cb):
        pass  # Kein Log bei Erfolg — zu viel Output


_listener = TradingCircuitBreakerListener()


# ── Capital.com Circuit Breaker ────────────────────────────────────────────────
# Öffnet nach 5 Fehlern → 60s Pause → testet wieder
capital_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    name="capital_com",
    listeners=[_listener],
)

# ── IC Markets Circuit Breaker ─────────────────────────────────────────────────
icmarkets_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    name="ic_markets",
    listeners=[_listener],
)

# ── yfinance Circuit Breaker ───────────────────────────────────────────────────
# Toleranter — yfinance ist externe API
yfinance_breaker = pybreaker.CircuitBreaker(
    fail_max=10,
    reset_timeout=120,
    name="yfinance",
    listeners=[_listener],
)

# ── Telegram Circuit Breaker ───────────────────────────────────────────────────
telegram_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    name="telegram",
    listeners=[_listener],
)

# ── News/RSS Circuit Breaker ───────────────────────────────────────────────────
news_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=180,
    name="news_rss",
    listeners=[_listener],
)


def get_all_status() -> dict:
    """Gibt Status aller Circuit Breaker zurück."""
    breakers = [capital_breaker, icmarkets_breaker, yfinance_breaker, telegram_breaker, news_breaker]
    return {
        cb.name: {
            "state":        cb.current_state,
            "fail_counter": cb.fail_counter,
            "fail_max":     cb.fail_max,
            "open":         cb.current_state == "open",
        }
        for cb in breakers
    }
