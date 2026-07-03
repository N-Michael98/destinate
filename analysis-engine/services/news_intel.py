"""
News & Geo Intelligence — läuft alle 2h.

Quellen (alle gratis, keine API-Keys):
  1. Zentralbank-RSS (Fed, EZB, SNB, BoE, BoJ) → Währungs-relevante News
  2. GDELT → geopolitische Lage (Kriege, Sanktionen, Handelskonflikte)
  3. FinBERT (via divine-warmth Backend) → Sentiment-Scoring der Headlines

Ergebnis → Redis `analysis:news` — strukturierte Daten für den
AI Learning Manager (Phase 4) und als News-Warnung für den Orchestrator.

Alles Fallback-sicher: fällt eine Quelle aus, laufen die anderen weiter.
"""

from datetime import datetime, timezone

import httpx
from loguru import logger

from core.config import settings
from services.storage import redis_set_json

REDIS_KEY_NEWS = "analysis:news"
TTL = 12 * 60 * 60  # 12h

# ── Zentralbanken (RSS) ───────────────────────────────────────────────────────
CENTRAL_BANK_FEEDS: dict[str, list[tuple[str, str]]] = {
    "USD": [("Fed", "https://www.federalreserve.gov/feeds/press_all.xml")],
    "EUR": [("EZB", "https://www.ecb.europa.eu/rss/press.html")],
    "CHF": [("SNB", "https://www.snb.ch/public/en/rss/news")],
    "GBP": [("BoE", "https://www.bankofengland.co.uk/rss/news")],
    "JPY": [("BoJ", "https://www.boj.or.jp/en/rss/whatsnew.xml")],
}
MAX_HEADLINES_PER_BANK = 5

# ── Geopolitische Themen (GDELT) ──────────────────────────────────────────────
GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GEO_TOPICS: list[dict] = [
    {"topic": "Russland-Ukraine", "query": '"Ukraine" "Russia" (war OR attack OR sanctions)',
     "affects": ["EUR", "NATGAS", "USOIL", "XAUUSD", "GER40"]},
    {"topic": "Nahost", "query": '("Israel" OR "Iran") (conflict OR strike OR war)',
     "affects": ["USOIL", "UKOIL", "XAUUSD"]},
    {"topic": "China-Taiwan", "query": '"China" "Taiwan" (tension OR military)',
     "affects": ["JPN225", "USDJPY", "NAS100"]},
    {"topic": "OPEC-Öl", "query": '"OPEC" (production OR output OR cut)',
     "affects": ["USOIL", "UKOIL"]},
    {"topic": "US-Handelspolitik", "query": '"United States" (tariffs OR "trade war")',
     "affects": ["USDCHF", "NAS100", "SPX500", "XAUUSD"]},
]


def _fetch_rss(url: str, limit: int) -> list[str]:
    """Headlines aus einem RSS-Feed. [] bei Fehler."""
    try:
        import feedparser
        feed = feedparser.parse(url)
        return [e.title.strip() for e in feed.entries[:limit] if getattr(e, "title", None)]
    except Exception as e:
        logger.warning(f"[news] RSS {url} fehlgeschlagen: {e}")
        return []


def _fetch_gdelt(query: str) -> dict:
    """GDELT-Artikel der letzten 24h zu einem Thema. Leeres Resultat bei Fehler."""
    try:
        resp = httpx.get(GDELT_URL, params={
            "query": query, "mode": "ArtList", "maxrecords": 15,
            "timespan": "24h", "format": "json",
        }, timeout=15)
        if resp.status_code != 200:
            return {"articleCount": 0, "titles": []}
        articles = resp.json().get("articles", [])
        titles = list({a.get("title", "").strip() for a in articles if a.get("title")})[:8]
        return {"articleCount": len(articles), "titles": titles}
    except Exception as e:
        logger.warning(f"[news] GDELT '{query[:30]}...' fehlgeschlagen: {e}")
        return {"articleCount": 0, "titles": []}


def _finbert_sentiment(text: str) -> dict | None:
    """Sentiment via divine-warmth FinBERT. None bei Fehler (non-fatal)."""
    if not settings.PYTHON_BACKEND_URL or not text.strip():
        return None
    try:
        resp = httpx.post(
            f"{settings.PYTHON_BACKEND_URL}/api/v1/finbert/analyze/text",
            json={"text": text[:1500]},
            timeout=90,  # erstes Model-Laden kann dauern
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"[news] FinBERT fehlgeschlagen: {e}")
    return None


def run_news_intel() -> None:
    logger.info("[news-intel] Zyklus gestartet")

    # 1. Zentralbanken
    central_banks: dict[str, dict] = {}
    for currency, feeds in CENTRAL_BANK_FEEDS.items():
        for source, url in feeds:
            headlines = _fetch_rss(url, MAX_HEADLINES_PER_BANK)
            if not headlines:
                continue
            sentiment = _finbert_sentiment(". ".join(headlines))
            central_banks[currency] = {
                "source": source,
                "headlines": headlines,
                "sentiment": sentiment,
            }
            logger.info(f"[news-intel] {source} ({currency}): {len(headlines)} Headlines")

    # 2. Geopolitik
    geopolitics: list[dict] = []
    for t in GEO_TOPICS:
        g = _fetch_gdelt(t["query"])
        sentiment = _finbert_sentiment(". ".join(g["titles"])) if g["titles"] else None
        geopolitics.append({
            "topic": t["topic"],
            "affects": t["affects"],
            "articleCount": g["articleCount"],
            "titles": g["titles"],
            "sentiment": sentiment,
        })
        logger.info(f"[news-intel] {t['topic']}: {g['articleCount']} Artikel")

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "centralBanks": central_banks,
        "geopolitics": geopolitics,
    }
    ok = redis_set_json(REDIS_KEY_NEWS, payload, TTL)
    logger.info(f"[news-intel] fertig — Redis={'ok' if ok else 'FEHLER'}")
