"""
Bewertung der Chartmuster (17.08.).

WOZU. chartmuster.py erkennt Doppeltop, Doppelboden, Schulter-Kopf-Schulter und
die drei Dreiecke — handelt aber bewusst nicht mit. Ob ein Muster etwas taugt,
war bis jetzt eine Behauptung aus Lehrbuechern, keine Messung an unseren
Maerkten. Dieses Modul beantwortet es.

DIE AUSWERTUNG IST NICHT NEU. Es wird bewerte_historie() aus
konsens_auswertung.py verwendet — dieselbe Funktion, die den
16-Strategien-Konsens misst. Sie bringt alles mit, worauf es ankommt und was
hier genauso gilt:

  RAND       fuer die letzten k Balken gibt es die Zukunft noch nicht; sie
             werden ausgelassen statt auf den letzten Kurs geklemmt
  BASIS      "nach einem Doppelboden ging es +0,4 % hoch" ist wertlos, wenn der
             Markt ueberall +0,4 % machte. Neben jeder Zahl steht die
             Marktbewegung ueber dieselben Balken
  BLOECKE    ein Muster steht oft ueber mehrere Balken; 40 Balken sind dann
             keine 40 unabhaengigen Faelle

Eine zweite, leicht andere Auswertung zu bauen waere genau die Sorte
Abweichung, die spaeter niemand mehr erklaeren kann — und sie muesste dieselben
drei Fallen noch einmal umgehen.

WAS GEMESSEN WIRD. Je MUSTERART getrennt: wie lief der Kurs nach einem
BESTAETIGTEN Muster, in dessen Richtung, verglichen mit der Marktbewegung im
selben Zeitraum. Ein unbestaetigtes Muster haette nie einen Einstieg
ausgeloest und zaehlt deshalb nicht.

WAS DARAUS NICHT FOLGT. Ein Vorteil in der Rueckrechnung heisst nicht, dass
das Muster handeln darf. Er heisst, dass es sich lohnt, weiter hinzuschauen.
Die Entscheidung, ein Muster in den Konsens aufzunehmen, gehoert dem Nutzer.
"""

import time
from datetime import datetime, timezone

import httpx
from loguru import logger

from core.config import settings
from services.backtest_engine import WATCHLIST
from services.konsens_auswertung import bewerte_historie, RICHTUNGEN
from services.storage import redis_set_json

REDIS_KEY_MUSTER = "analysis:muster"
TTL = 8 * 24 * 60 * 60  # 8 Tage — laeuft woechentlich

STANDARD_FENSTER_TAGE = 365
# Dieselbe Obergrenze, die der Endpunkt in divine-warmth durchsetzt. Hier
# geklemmt statt ungeprueft geschickt — sonst antwortet das Backend auf jedes
# Symbol mit HTTP 400 und der Lauf liefert stillschweigend nichts.
MAX_FENSTER_TAGE = 730
PAUSE_SEK = 2


def _fensterlaenge() -> int:
    roh = int(getattr(settings, "MUSTER_FENSTER_TAGE", 0) or 0)
    if roh <= 0:
        return STANDARD_FENSTER_TAGE
    if roh > MAX_FENSTER_TAGE:
        logger.warning(
            f"[muster] MUSTER_FENSTER_TAGE={roh} ueberschreitet die Grenze des "
            f"Backends ({MAX_FENSTER_TAGE}) — auf {MAX_FENSTER_TAGE} geklemmt")
        return MAX_FENSTER_TAGE
    return roh


FENSTER_TAGE = _fensterlaenge()


def hole_musterhistorie(symbol: str, tage: int = FENSTER_TAGE) -> dict | None:
    """Holt die Muster-Reihe von divine-warmth. None bei Fehler."""
    if not settings.PYTHON_BACKEND_URL:
        logger.warning("[muster] PYTHON_BACKEND_URL nicht gesetzt — uebersprungen")
        return None
    try:
        antwort = httpx.get(
            f"{settings.PYTHON_BACKEND_URL}/api/v1/strategies/muster-historie/{symbol}",
            params={"tage": tage, "interval": "1d"},
            headers={"X-Backend-Key": settings.BACKEND_API_KEY} if settings.BACKEND_API_KEY else {},
            # Gemessen rund 1 Sekunde je Jahr Tageskerzen; grosszuegig, damit
            # geleistete Arbeit nicht wegen eines knappen Timeouts wegfaellt.
            timeout=300,
        )
        if antwort.status_code != 200:
            logger.warning(f"[muster] {symbol}: HTTP {antwort.status_code} — {antwort.text[:120]}")
            return None
        return antwort.json()
    except Exception as e:
        logger.warning(f"[muster] {symbol}: {type(e).__name__}: {e}")
        return None


def _reihe_fuer(historie: dict, musterart: str) -> dict:
    """Baut aus der Muster-Historie eine Reihe fuer GENAU EINE Musterart.

    Alle anderen Balken werden auf NEUTRAL gesetzt. Damit misst
    bewerte_historie() nur diese eine Art — und die Basis (Marktbewegung ueber
    dieselben Balken) bleibt unveraendert, weil sie ueber ALLE Balken rechnet.
    Genau deshalb ist der Vergleich zwischen den Musterarten fair.
    """
    tiers = historie.get("entryQualityTier") or []
    konsens = historie.get("konsens") or []
    gefiltert = [
        konsens[i] if i < len(tiers) and tiers[i] == musterart else "NEUTRAL"
        for i in range(len(konsens))
    ]
    return {**historie, "konsens": gefiltert}


def bewerte_muster(historie: dict) -> dict:
    """Bewertet jede Musterart einzeln — mit der Auswertung des Konsenses."""
    if historie.get("status") != "ok":
        return {"status": historie.get("status", "unbekannt"),
                "hinweise": historie.get("hinweise", [])}

    gesamt = bewerte_historie(historie)
    if gesamt.get("status") != "ok":
        return gesamt

    tiers = historie.get("entryQualityTier") or []
    arten = sorted({t for t in tiers if t and t != "KEIN_MUSTER"})

    je_art: dict[str, dict] = {}
    for art in arten:
        teil = bewerte_historie(_reihe_fuer(historie, art))
        if teil.get("status") != "ok":
            continue
        tag = (teil.get("horizonte") or {}).get("daytrading_24h", {}).get("alle", {})
        je_art[art] = {
            "bloecke": teil.get("bloecke", {}),
            "horizonte": teil.get("horizonte", {}),
            "faelle": sum(int((tag.get(r) or {}).get("n", 0)) for r in RICHTUNGEN),
        }

    # Auch die unbestaetigten mitzaehlen — dann laesst sich beantworten, ob die
    # Bestaetigung ueberhaupt etwas bringt. Ohne diese Zahl waere "bestaetigt"
    # eine Regel ohne Beleg.
    erkannt: dict[str, int] = {}
    for liste in historie.get("musterAlle") or []:
        for name in liste:
            erkannt[name] = erkannt.get(name, 0) + 1

    return {
        "symbol": historie.get("symbol"),
        "status": "ok",
        "balken": gesamt.get("balken"),
        "von": gesamt.get("von"),
        "bis": gesamt.get("bis"),
        "fensterTage": historie.get("fensterTage"),
        "taktIntervall": historie.get("taktIntervall"),
        "gesamt": gesamt.get("horizonte"),
        "verteilung": gesamt.get("verteilung"),
        "jeMusterart": je_art,
        "erkanntGesamt": erkannt,
        "balkenOhneVorlauf": historie.get("balkenOhneVorlauf", 0),
        "hinweise": list(historie.get("hinweise", [])),
    }


def run_muster_auswertung() -> None:
    """Wrapper mit Fern-Diagnose (gleiches Muster wie run_konsens_auswertung)."""
    try:
        _run_muster_auswertung_inner()
    except Exception as e:
        import traceback
        logger.error(f"[muster] ABGESTUERZT: {e}\n{traceback.format_exc()}")
        redis_set_json(REDIS_KEY_MUSTER, {
            "status": "error", "error": str(e),
            "trace": traceback.format_exc()[-1500:],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)


def _run_muster_auswertung_inner() -> None:
    begonnen = time.time()
    logger.info(f"[muster] Lauf gestartet — Fenster {FENSTER_TAGE} Tage")

    ergebnisse: dict[str, dict] = {}
    for idx, symbol in enumerate(WATCHLIST):
        redis_set_json(REDIS_KEY_MUSTER, {
            "status": "running", "progress": f"{idx}/{len(WATCHLIST)}",
            "currentSymbol": symbol, "elapsedSec": round(time.time() - begonnen),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, TTL)

        historie = hole_musterhistorie(symbol)
        if historie is None:
            continue
        bewertung = bewerte_muster(historie)
        if bewertung.get("status") != "ok":
            logger.warning(f"[muster] {symbol}: {bewertung.get('status')} — "
                           f"{'; '.join(bewertung.get('hinweise', [])[:2])}")
            continue
        ergebnisse[symbol] = bewertung
        arten = ", ".join(f"{a}={d['faelle']}" for a, d in bewertung["jeMusterart"].items())
        logger.info(f"[muster] {symbol}: {bewertung['balken']} Balken, {arten or 'kein Muster'}")
        time.sleep(PAUSE_SEK)

    zusammenfassung = {
        "status": "done",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "durationSec": round(time.time() - begonnen),
        "fensterTage": FENSTER_TAGE,
        "symbole": len(ergebnisse),
        "results": ergebnisse,
    }
    ok = redis_set_json(REDIS_KEY_MUSTER, zusammenfassung, TTL)
    logger.info(f"[muster] fertig — {len(ergebnisse)} Symbole in "
                f"{zusammenfassung['durationSec']}s, Redis={'ok' if ok else 'FEHLER'}")
