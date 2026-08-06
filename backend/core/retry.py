"""
Tenacity Auto-Retry — G2G
Wrapper für API Calls die gelegentlich fehlschlagen.
"""

from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type,
)
import logging

from core.log_drossel import gedrosselt

logger = logging.getLogger(__name__)


def _vor_dem_warten(retry_state) -> None:
    """Ersetzt tenacitys before_sleep_log (06.08.).

    Gemessen: before_sleep_log schreibt EINE Zeile je Wiederholungsversuch, bei
    max_attempts=3 also zwei je Aufruf. Ein Scan-Zyklus loest rund 300 Abrufe
    gleichzeitig aus — 600 Zeilen in genau der Sekunde, in der der
    Sicherungsschalter aufreisst. Das ist die Sekunde, in der die URSACHE steht.
    Am 06.08. hat uns dieselbe Flut 159 Meldungen gekostet.

    Das Wiederholverhalten selbst bleibt unveraendert: gleiche Anzahl Versuche,
    gleiche Wartezeiten, gleiche Ausnahmetypen. Nur die Ausgabe wird gezaehlt
    statt wiederholt.
    """
    name = getattr(retry_state.fn, "__name__", "?")
    ausnahme = retry_state.outcome.exception() if retry_state.outcome else None
    schlaf = getattr(retry_state.next_action, "sleep", 0)
    # Die Versuchsnummer gehoert in den SCHLUESSEL, nicht nur in den Text.
    #
    # Erster Entwurf hatte sie nur im Text — und der wechselt dadurch bei jedem
    # Aufruf zwischen "Versuch 1" und "Versuch 2". Die Drossel wertet einen
    # geaenderten Text als neue Ursache und laesst ihn sofort durch: gemessen
    # kamen 600 von 600 Zeilen weiterhin an, die Behebung war wirkungslos.
    # Mit der Nummer im Schluessel wird jede Versuchsstufe fuer sich gezaehlt
    # (2 Zeilen statt 600), waehrend ein anderer Fehlertext weiterhin sofort
    # durchkommt.
    gedrosselt(
        logger.warning,
        f"retry:{name}:{retry_state.attempt_number}",
        f"[retry] {name}: Versuch {retry_state.attempt_number} scheiterte "
        f"({type(ausnahme).__name__}: {str(ausnahme)[:120]}), "
        f"warte {schlaf:.1f}s",
    )

# Standard Retry: 3 Versuche, exponentielles Warten (1s, 2s, 4s)
def api_retry(max_attempts: int = 3, min_wait: float = 1, max_wait: float = 8):
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        before_sleep=_vor_dem_warten,
        reraise=True,
    )

# Verwendung: @api_retry() als Decorator über eine Funktion
