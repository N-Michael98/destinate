"""
Insights API — liefert die aktuellen Analyse-Ergebnisse.

Der Orchestrator (destinate) liest diese Insights später als
zusätzlichen Filter. Fällt dieser Service aus, läuft das Trading
unverändert weiter — Insights sind rein additiv.
"""

import json

from fastapi import APIRouter

router = APIRouter()

REDIS_KEY_INSIGHTS = "analysis:insights"


def _get_redis():
    """Lazy Redis-Verbindung — Service startet auch ohne Redis."""
    from core.config import settings
    if not settings.REDIS_URL:
        return None
    try:
        import redis
        return redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=5)
    except Exception:
        return None


@router.get("/insights")
def get_insights():
    """Aktuelle Insights aus Redis (vom AI Learning Manager geschrieben)."""
    r = _get_redis()
    if r is None:
        return {"available": False, "reason": "Redis nicht konfiguriert"}
    try:
        raw = r.get(REDIS_KEY_INSIGHTS)
        if not raw:
            return {"available": False, "reason": "Noch keine Analyse gelaufen"}
        return {"available": True, "insights": json.loads(raw)}
    except Exception as e:
        return {"available": False, "reason": str(e)}
