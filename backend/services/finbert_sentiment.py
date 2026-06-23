"""
FinBERT Sentiment Analysis — G2F Professional
ProsusAI/finbert: BERT fine-tuned auf Financial Text.
~85% Genauigkeit vs VADER ~70%.
Model wird lazy geladen (nur beim ersten API Call, nicht beim Start).
"""

import logging
from functools import lru_cache
from typing import Optional
from services.sentiment_analysis import fetch_headlines, SYMBOL_KEYWORDS

logger = logging.getLogger(__name__)

_pipeline = None


def _get_pipeline():
    """Lazy load FinBERT — nur beim ersten Aufruf, danach gecacht."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from transformers import pipeline
        logger.info("[finbert] Lade ProsusAI/finbert Model (einmalig ~400MB)...")
        _pipeline = pipeline(
            "text-classification",
            model="ProsusAI/finbert",
            device=-1,  # CPU
            top_k=None,
        )
        logger.info("[finbert] Model geladen ✅")
        return _pipeline
    except ImportError:
        logger.error("[finbert] transformers nicht installiert")
        return None
    except Exception as e:
        logger.error(f"[finbert] Model Load Fehler: {e}")
        return None


def _classify_text(text: str) -> Optional[dict]:
    """Klassifiziert einen Text mit FinBERT."""
    pipe = _get_pipeline()
    if pipe is None:
        return None
    try:
        text = text[:512]  # BERT max tokens
        results = pipe(text)[0]
        scores = {r["label"]: round(r["score"], 4) for r in results}
        label = max(scores, key=scores.get)
        return {
            "label":    label,
            "positive": scores.get("positive", 0),
            "negative": scores.get("negative", 0),
            "neutral":  scores.get("neutral", 0),
            "confidence": scores.get(label, 0),
        }
    except Exception as e:
        logger.error(f"[finbert] classify Fehler: {e}")
        return None


def finbert_analyze_text(text: str) -> dict:
    """Analysiert einen einzelnen Text mit FinBERT."""
    result = _classify_text(text)
    if result is None:
        return {"error": "FinBERT nicht verfügbar", "text": text[:80]}
    return {"text": text[:80], **result}


def finbert_symbol_sentiment(symbol: str) -> dict:
    """
    Holt RSS Headlines für ein Symbol und analysiert sie mit FinBERT.
    Gibt aggregiertes Sentiment + Einzel-Headlines zurück.
    """
    pipe = _get_pipeline()
    if pipe is None:
        return {
            "error":  "FinBERT nicht verfügbar",
            "symbol": symbol,
            "fallback": "Nutze /api/v1/sentiment/analyze/" + symbol,
        }

    keywords = SYMBOL_KEYWORDS.get(symbol.upper(), [symbol.lower()])
    all_headlines = fetch_headlines(max_per_feed=5)

    relevant = [
        h for h in all_headlines
        if any(kw.lower() in h.lower() for kw in keywords)
    ][:15]

    if not relevant:
        return {
            "symbol":   symbol,
            "sentiment": "neutral",
            "score":    0.0,
            "headlines_analyzed": 0,
            "note": "Keine relevanten Headlines gefunden",
        }

    results = []
    pos_sum = neg_sum = neu_sum = 0.0

    for headline in relevant:
        r = _classify_text(headline)
        if r:
            results.append({"headline": headline[:100], **r})
            pos_sum += r["positive"]
            neg_sum += r["negative"]
            neu_sum += r["neutral"]

    n = len(results)
    if n == 0:
        return {"symbol": symbol, "error": "Keine Resultate", "headlines_analyzed": 0}

    avg_pos = round(pos_sum / n, 4)
    avg_neg = round(neg_sum / n, 4)
    avg_neu = round(neu_sum / n, 4)

    if avg_pos > avg_neg and avg_pos > avg_neu:
        overall = "positive"
        score = round(avg_pos - avg_neg, 4)
    elif avg_neg > avg_pos and avg_neg > avg_neu:
        overall = "negative"
        score = round(-(avg_neg - avg_pos), 4)
    else:
        overall = "neutral"
        score = 0.0

    return {
        "symbol":             symbol,
        "sentiment":          overall,
        "score":              score,
        "avg_positive":       avg_pos,
        "avg_negative":       avg_neg,
        "avg_neutral":        avg_neu,
        "headlines_analyzed": n,
        "headlines":          results,
        "model":              "ProsusAI/finbert",
    }


def finbert_multi_symbol(symbols: list[str]) -> list[dict]:
    """Analysiert mehrere Symbole mit FinBERT."""
    return [finbert_symbol_sentiment(s) for s in symbols[:5]]
