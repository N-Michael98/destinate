"""
Circuit Breaker — pybreaker
Schützt vor API-Spam bei Ausfällen.
Wenn ein API X-mal hintereinander fehlschlägt → Circuit öffnet sich → keine weiteren Calls.
Nach Timeout → Circuit halbgeöffnet → testet erneut.
"""

import logging
import threading
import time
import pybreaker
from datetime import datetime

logger = logging.getLogger(__name__)

# Drosselung fuer failure() (06.08.).
#
# Anlass: am 06.08. lief der yfinance-Schalter offen. Im Log war ueberall
# "Timeout not elapsed yet, circuit breaker still open" zu lesen — also die
# FOLGE. Die Zeile mit der URSACHE, dem Fehler der den Schalter ueberhaupt
# aufgerissen hat, war nicht auffindbar. Railway meldete um 18:22:36
# "rate limit of 500 logs/sec reached ... Messages dropped: 159".
#
# Ein Scan-Zyklus feuert rund 300 yfinance-Abrufe GLEICHZEITIG. Scheitern die,
# ruft pybreaker failure() fuer jeden einzelnen auf — bis zu 300 Zeilen in
# derselben Sekunde, alle mit demselben Text. Genau darin geht die eine Zeile
# unter, auf die es ankommt.
#
# Deshalb: der ERSTE Fehler eines Schwalls wird immer vollstaendig geloggt,
# Wiederholungen desselben Textes werden nur gezaehlt. Aendert sich der Text,
# wird sofort wieder ausgeschrieben — eine NEUE Ursache darf nie unterdrueckt
# werden. state_change() bleibt ungedrosselt: der Zustandswechsel ist die
# wichtigste Zeile ueberhaupt.
_FEHLER_FENSTER_SEC = 5.0
_fehler_zustand: dict[str, dict] = {}
_fehler_sperre = threading.Lock()


class TradingCircuitBreakerListener(pybreaker.CircuitBreakerListener):
    """Loggt alle Circuit Breaker State Changes."""

    def state_change(self, cb, old_state, new_state):
        # NIEMALS drosseln — das ist die Zeile, an der man den Ausfall erkennt.
        logger.warning(
            f"[circuit-breaker] {cb.name}: {old_state.name} → {new_state.name}"
        )

    def failure(self, cb, exc):
        text = str(exc)[:200]
        jetzt = time.monotonic()
        with _fehler_sperre:
            z = _fehler_zustand.setdefault(
                cb.name, {"zuletzt": 0.0, "unterdrueckt": 0, "text": None}
            )
            gleicher_text = z["text"] == text
            zu_frisch = (jetzt - z["zuletzt"]) < _FEHLER_FENSTER_SEC
            if gleicher_text and zu_frisch:
                z["unterdrueckt"] += 1
                return
            unterdrueckt = z["unterdrueckt"]
            z.update({"zuletzt": jetzt, "unterdrueckt": 0, "text": text})

        zusatz = (
            f" (+{unterdrueckt} weitere gleiche in den letzten "
            f"{_FEHLER_FENSTER_SEC:.0f}s unterdrückt)"
            if unterdrueckt
            else ""
        )
        logger.error(f"[circuit-breaker] {cb.name} Fehler: {text}{zusatz}")

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
# Toleranter — yfinance ist externe API. ValueError (ungültiges Interval/Period)
# ist eine Input-Validierung, kein Zeichen dass yfinance down ist -> zählt nicht
# als Fehler für den Breaker (Audit-Fund #4, 27.07.).
yfinance_breaker = pybreaker.CircuitBreaker(
    fail_max=10,
    reset_timeout=120,
    name="yfinance",
    listeners=[_listener],
    exclude=[ValueError],
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
