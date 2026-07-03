"""Debug/Monitoring-Routes: gesammelte Daten einsehen + Jobs manuell triggern."""

from fastapi import APIRouter, BackgroundTasks

from services.storage import redis_get_json
from services.data_collector import run_data_collector, REDIS_KEY_TRADE_STATS
from services.news_intel import run_news_intel, REDIS_KEY_NEWS
from services.backtest_engine import run_backtests, REDIS_KEY_BACKTESTS

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
