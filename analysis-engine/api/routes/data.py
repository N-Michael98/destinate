"""Debug/Monitoring-Routes: gesammelte Daten einsehen + Jobs manuell triggern."""

from fastapi import APIRouter, BackgroundTasks

from services.storage import redis_get_json
from services.data_collector import run_data_collector, REDIS_KEY_TRADE_STATS
from services.news_intel import run_news_intel, REDIS_KEY_NEWS
from services.backtest_engine import run_backtests, REDIS_KEY_BACKTESTS
from services.ai_learning import run_ai_learning
from services.recommendations import run_recommendations, REDIS_KEY_RECOMMENDATIONS

router = APIRouter()


@router.get("/trade-stats")
def get_trade_stats():
    data = redis_get_json(REDIS_KEY_TRADE_STATS)
    return {"available": data is not None, "data": data}


@router.get("/news")
def get_news():
    data = redis_get_json(REDIS_KEY_NEWS)
    return {"available": data is not None, "data": data}


@router.post("/run/data-collector")
def trigger_data_collector(bg: BackgroundTasks):
    """Job manuell starten (läuft im Hintergrund)."""
    bg.add_task(run_data_collector)
    return {"started": True, "job": "data-collector", "check": "/api/v1/trade-stats"}


@router.post("/run/news-intel")
def trigger_news_intel(bg: BackgroundTasks):
    bg.add_task(run_news_intel)
    return {"started": True, "job": "news-intel", "check": "/api/v1/news"}


@router.get("/backtests")
def get_backtests():
    data = redis_get_json(REDIS_KEY_BACKTESTS)
    return {"available": data is not None, "data": data}


@router.post("/run/backtest")
def trigger_backtest(bg: BackgroundTasks):
    """Nächtlichen Backtest manuell starten (dauert einige Minuten)."""
    bg.add_task(run_backtests)
    return {"started": True, "job": "backtest", "check": "/api/v1/backtests"}


@router.post("/run/ai-learning")
def trigger_ai_learning(bg: BackgroundTasks):
    """AI Learning Manager manuell starten (Claude-Analyse + Telegram-Report)."""
    bg.add_task(run_ai_learning)
    return {"started": True, "job": "ai-learning", "check": "/api/v1/insights"}


@router.get("/recommendations")
def get_recommendations():
    data = redis_get_json(REDIS_KEY_RECOMMENDATIONS)
    return {"available": data is not None, "data": data}


@router.post("/run/recommendations")
def trigger_recommendations(bg: BackgroundTasks):
    """Vorschlags-Generator manuell starten (meldet nur, wendet nichts an)."""
    bg.add_task(run_recommendations)
    return {"started": True, "job": "recommendations", "check": "/api/v1/recommendations"}


@router.post("/run/weekly-report")
def trigger_weekly_report(bg: BackgroundTasks):
    """Wochen-Report manuell auslösen (Telegram)."""
    from services.periodic_report import run_weekly_report
    bg.add_task(run_weekly_report)
    return {"started": True, "job": "weekly-report"}


@router.get("/comms-check")
def comms_check():
    """Verbindungs-Check: beweist jede Kommunikations-Strecke mit echten Daten."""
    from services.storage import pg_query, get_redis

    result: dict = {}

    # 1. PostgreSQL lesen (Trade-Tabelle von destinate)
    rows = pg_query('SELECT COUNT(*) FROM "Trade"')
    result["pg_read_trades"] = {"ok": bool(rows), "count": rows[0][0] if rows else None}

    # 2. PostgreSQL schreiben (BacktestRun-INSERTs der Backtest Engine)
    rows = pg_query('SELECT COUNT(*), MAX("createdAt") FROM "BacktestRun"')
    result["pg_write_backtestruns"] = {
        "ok": bool(rows and rows[0][0] > 0),
        "count": rows[0][0] if rows else None,
        "lastInsert": str(rows[0][1]) if rows and rows[0][1] else None,
    }

    # 3. Redis (alle 4 Analyse-Keys mit Frische)
    r = get_redis()
    redis_keys = {}
    if r:
        import json as _json
        for key in ("analysis:trade_stats", "analysis:news", "analysis:backtests", "analysis:insights"):
            try:
                raw = r.get(key)
                updated = _json.loads(raw).get("updatedAt") if raw else None
                redis_keys[key] = {"exists": raw is not None, "updatedAt": updated}
            except Exception as e:
                redis_keys[key] = {"exists": False, "error": str(e)}
    result["redis"] = {"ok": r is not None, "keys": redis_keys}

    # 4. divine-warmth Backend (Preis-Daten)
    import httpx
    from core.config import settings
    try:
        resp = httpx.get(f"{settings.PYTHON_BACKEND_URL}/health", timeout=10)
        result["divine_warmth"] = {"ok": resp.status_code == 200, "status": resp.status_code}
    except Exception as e:
        result["divine_warmth"] = {"ok": False, "error": str(e)}

    return result
