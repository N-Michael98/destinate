"""
Economic Calendar API
GET /api/v1/intelligence/calendar  → HIGH-Impact Events diese Woche (ForexFactory)
"""
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])
logger = logging.getLogger(__name__)

# Currency → betroffene Trading-Symbole
CURRENCY_SYMBOLS: dict[str, list[str]] = {
    "USD": ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
            "EURJPY", "GBPJPY", "XAUUSD", "USOIL", "UKOIL", "NAS100", "SPX500", "DJ30"],
    "EUR": ["EURUSD", "EURGBP", "EURJPY"],
    "GBP": ["GBPUSD", "EURGBP", "GBPJPY"],
    "JPY": ["USDJPY", "EURJPY", "GBPJPY"],
    "CHF": ["USDCHF"],
    "AUD": ["AUDUSD"],
    "CAD": ["USDCAD", "UKOIL", "USOIL"],
    "NZD": ["NZDUSD"],
}

_calendar_cache: dict = {"data": [], "fetched_at": None}
_CACHE_TTL_SECONDS = 3600  # 1h cache


async def _fetch_ff_calendar() -> list[dict]:
    """Holt ForexFactory Wochenkalender (kostenlos, kein API Key)."""
    now = datetime.now(timezone.utc)
    cache = _calendar_cache
    if cache["fetched_at"] and (now - cache["fetched_at"]).total_seconds() < _CACHE_TTL_SECONDS:
        return cache["data"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code != 200:
                return cache["data"]
            raw: list[dict] = r.json()
            # Nur HIGH + MEDIUM Impact, datum parsen
            events = []
            for ev in raw:
                impact = (ev.get("impact") or "").upper()
                if impact not in ("HIGH", "MEDIUM"):
                    continue
                currency = (ev.get("country") or ev.get("currency") or "").upper()
                date_str = ev.get("date") or ""
                try:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except Exception:
                    continue
                events.append({
                    "name":      ev.get("title", ""),
                    "currency":  currency,
                    "impact":    impact,
                    "time_utc":  dt.isoformat(),
                    "symbols":   CURRENCY_SYMBOLS.get(currency, []),
                })
            cache["data"] = events
            cache["fetched_at"] = now
            logger.info(f"[calendar] {len(events)} HIGH/MEDIUM events geladen")
            return events
    except Exception as e:
        logger.warning(f"[calendar] ForexFactory Fetch fehlgeschlagen: {e}")
        return cache["data"]


@router.get("/calendar")
async def get_calendar():
    events = await _fetch_ff_calendar()
    return {"events": events, "count": len(events)}


@router.get("/calendar/blackout/{symbol}")
async def check_blackout(symbol: str, window_min: int = 30):
    """Prüft ob ein Symbol aktuell in einem News-Blackout-Fenster ist."""
    events = await _fetch_ff_calendar()
    now = datetime.now(timezone.utc)
    sym = symbol.upper()
    blocked = []
    for ev in events:
        if sym not in ev["symbols"] and ev["impact"] != "HIGH":
            continue
        if sym not in ev["symbols"]:
            continue
        try:
            ev_time = datetime.fromisoformat(ev["time_utc"])
            diff_min = (ev_time - now).total_seconds() / 60
            if -window_min <= diff_min <= window_min:
                blocked.append({
                    "event":    ev["name"],
                    "currency": ev["currency"],
                    "impact":   ev["impact"],
                    "minutes":  round(diff_min, 1),
                })
        except Exception:
            continue
    return {
        "symbol":  sym,
        "blocked": len(blocked) > 0,
        "reason":  blocked[0]["event"] if blocked else None,
        "events":  blocked,
    }
