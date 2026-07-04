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

# ── Geopolitische Themen (via Welt-News-RSS + Keyword-Matching) ───────────────
# GDELT wurde ersetzt: dessen Rate-Limit ist IP-basiert und Cloud-IPs
# (Railway) teilen es sich → dauerhaft HTTP 429. RSS ist zuverlässig.
GEO_FEEDS: list[tuple[str, str]] = [
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ("Deutsche Welle", "https://rss.dw.com/rdf/rss-en-world"),
]
GEO_TOPICS: list[dict] = [
    {"topic": "Russland-Ukraine",
     "keywords": ["ukraine", "russia", "russian", "kyiv", "moscow", "putin", "zelensky"],
     "affects": ["EUR", "NATGAS", "USOIL", "XAUUSD", "GER40"]},
    {"topic": "Nahost",
     "keywords": ["israel", "iran", "gaza", "middle east", "hezbollah", "tehran", "lebanon", "houthi"],
     "affects": ["USOIL", "UKOIL", "XAUUSD"]},
    {"topic": "China-Taiwan",
     "keywords": ["taiwan", "beijing", "china military", "south china sea"],
     "affects": ["JPN225", "USDJPY", "NAS100"]},
    {"topic": "OPEC-Öl",
     "keywords": ["opec", "oil price", "crude", "oil production", "oil output"],
     "affects": ["USOIL", "UKOIL"]},
    {"topic": "US-Handelspolitik",
     "keywords": ["tariff", "trade war", "trade deal", "sanctions", "export controls"],
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


def _fetch_geo_headlines() -> tuple[list[str], list[str]]:
    """Alle Welt-News-Headlines aus den GEO_FEEDS. (headlines, feed_errors)"""
    headlines: list[str] = []
    errors: list[str] = []
    for source, url in GEO_FEEDS:
        got = _fetch_rss(url, 40)
        if got:
            headlines.extend(got)
            logger.info(f"[news-intel] {source}: {len(got)} Welt-Headlines")
        else:
            errors.append(f"{source}: keine Headlines")
    # Duplikate raus, Reihenfolge behalten
    seen: set[str] = set()
    unique = [h for h in headlines if not (h.lower() in seen or seen.add(h.lower()))]
    return unique, errors


def _match_topic(headlines: list[str], keywords: list[str]) -> list[str]:
    """Headlines die zu einem Themen-Keyword passen (case-insensitive)."""
    kws = [k.lower() for k in keywords]
    return [h for h in headlines if any(k in h.lower() for k in kws)][:8]


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

    # 2. Geopolitik — Welt-News-RSS (BBC/AlJazeera/DW) + Keyword-Matching
    all_headlines, feed_errors = _fetch_geo_headlines()
    geopolitics: list[dict] = []
    for t in GEO_TOPICS:
        titles = _match_topic(all_headlines, t["keywords"])
        sentiment = _finbert_sentiment(". ".join(titles)) if titles else None
        geopolitics.append({
            "topic": t["topic"],
            "affects": t["affects"],
            "articleCount": len(titles),
            "titles": titles,
            "sentiment": sentiment,
            "error": "; ".join(feed_errors) if (not all_headlines and feed_errors) else None,
        })
        logger.info(f"[news-intel] {t['topic']}: {len(titles)} Artikel")

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "centralBanks": central_banks,
        "geopolitics": geopolitics,
    }
    ok = redis_set_json(REDIS_KEY_NEWS, payload, TTL)
    logger.info(f"[news-intel] fertig — Redis={'ok' if ok else 'FEHLER'}")
