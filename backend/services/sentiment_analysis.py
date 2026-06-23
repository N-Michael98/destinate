"""
Sentiment Analysis — G2F
VADER: schnelles Sentiment für News-Headlines
feedparser: RSS Feeds von Finanz-Nachrichtenquellen
"""

import logging
import feedparser
from typing import Optional

logger = logging.getLogger(__name__)

# ── RSS Feeds ─────────────────────────────────────────────────────────────────

RSS_FEEDS = {
    "reuters":     "https://feeds.reuters.com/reuters/businessNews",
    "bloomberg":   "https://feeds.bloomberg.com/markets/news.rss",
    "forexlive":   "https://www.forexlive.com/feed/news",
    "investing":   "https://www.investing.com/rss/news.rss",
    "marketwatch": "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",
}

SYMBOL_KEYWORDS = {
    "XAUUSD": ["gold", "xau", "bullion", "precious metal"],
    "EURUSD": ["euro", "eur", "ecb", "european central bank"],
    "GBPUSD": ["pound", "gbp", "sterling", "boe", "bank of england"],
    "USDJPY": ["yen", "jpy", "boj", "bank of japan"],
    "USOIL":  ["oil", "crude", "wti", "opec", "petroleum"],
    "BRENT":  ["brent", "oil", "crude", "opec"],
    "NAS100": ["nasdaq", "tech stocks", "fed", "federal reserve"],
    "US500":  ["s&p", "sp500", "federal reserve", "fed"],
    "BTCUSD": ["bitcoin", "btc", "crypto", "cryptocurrency"],
}

def fetch_article_text(url: str, timeout: int = 10) -> Optional[str]:
    """
    Lädt den vollen Artikel-Text via newspaper3k.
    Gibt None zurück wenn nicht verfügbar oder Fehler.
    """
    try:
        from newspaper import Article
        article = Article(url)
        article.download()
        article.parse()
        text = article.text.strip()
        return text[:3000] if text else None
    except ImportError:
        logger.warning("[sentiment] newspaper3k nicht installiert")
        return None
    except Exception as e:
        logger.debug(f"[sentiment] Article fetch Fehler {url[:50]}: {e}")
        return None


def fetch_headlines(max_per_feed: int = 5) -> list[dict]:
    """Holt Headlines von allen RSS Feeds."""
    headlines = []
    for source, url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:max_per_feed]:
                headlines.append({
                    "source":  source,
                    "title":   entry.get("title", ""),
                    "summary": entry.get("summary", "")[:200],
                    "link":    entry.get("link", ""),
                    "published": entry.get("published", ""),
                })
        except Exception as e:
            logger.warning(f"[sentiment] Feed {source} Fehler: {e}")
    return headlines

def analyze_sentiment(text: str) -> dict:
    """VADER Sentiment Analyse für einen Text."""
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        analyzer = SentimentIntensityAnalyzer()
        scores = analyzer.polarity_scores(text)
        compound = scores["compound"]
        if compound >= 0.05:
            label = "POSITIVE"
        elif compound <= -0.05:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"
        return {
            "compound": round(compound, 4),
            "label":    label,
            "pos":      round(scores["pos"], 3),
            "neg":      round(scores["neg"], 3),
            "neu":      round(scores["neu"], 3),
        }
    except ImportError:
        return {"compound": 0, "label": "NEUTRAL", "pos": 0, "neg": 0, "neu": 1}

def symbol_sentiment(symbol: str, headlines: Optional[list[dict]] = None) -> dict:
    """
    Filtert Headlines nach Symbol-Keywords und berechnet Durchschnitts-Sentiment.
    """
    sym = symbol.upper()
    keywords = SYMBOL_KEYWORDS.get(sym, [sym.lower()])

    if headlines is None:
        headlines = fetch_headlines()

    relevant = []
    for h in headlines:
        text = (h.get("title", "") + " " + h.get("summary", "")).lower()
        if any(kw in text for kw in keywords):
            sentiment = analyze_sentiment(h["title"])
            relevant.append({**h, "sentiment": sentiment})

    if not relevant:
        return {
            "symbol":    sym,
            "signal":    "NEUTRAL",
            "score":     0.0,
            "count":     0,
            "headlines": [],
        }

    avg_compound = sum(r["sentiment"]["compound"] for r in relevant) / len(relevant)
    signal = "BUY" if avg_compound > 0.05 else "SELL" if avg_compound < -0.05 else "NEUTRAL"

    return {
        "symbol":    sym,
        "signal":    signal,
        "score":     round(avg_compound, 4),
        "count":     len(relevant),
        "headlines": relevant[:5],
    }

def multi_symbol_sentiment(symbols: list[str]) -> list[dict]:
    """Sentiment für mehrere Symbole mit einem Feed-Fetch."""
    try:
        headlines = fetch_headlines()
        return [symbol_sentiment(sym, headlines) for sym in symbols]
    except Exception as e:
        logger.error(f"[sentiment] multi Fehler: {e}")
        return [{"symbol": sym, "signal": "NEUTRAL", "score": 0, "count": 0} for sym in symbols]
