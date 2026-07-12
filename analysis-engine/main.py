"""
Destinate Analysis Engine — autonomer Analyse-Service

Module (werden Phase für Phase aktiviert):
  Phase 2: Data Collector + News/Geo Intelligence
  Phase 3: Backtest Engine (vectorbt, nachts 02:00 UTC)
  Phase 4: Forward-Test Validator + AI Learning Manager
  Phase 5: Orchestrator-Integration (liest analysis:insights aus Redis)

Dieser Service ist rein additiv: er liest Daten und publiziert
Empfehlungen. Das Live-Trading (destinate) läuft auch ohne ihn.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from loguru import logger

from core.config import settings
from api.routes import health, insights, data

scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: Scheduler für autonome Jobs starten."""
    global scheduler
    try:
        from datetime import datetime, timedelta, timezone

        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        from services.data_collector import run_data_collector
        from services.news_intel import run_news_intel
        from services.backtest_engine import run_backtests
        from services.ai_learning import run_ai_learning
        from services.recommendations import run_recommendations

        scheduler = AsyncIOScheduler(timezone="UTC")

        # Phase 2: Data Collector alle 4h, News-Intel alle 2h
        scheduler.add_job(run_data_collector, "interval", hours=4, id="data-collector")
        scheduler.add_job(run_news_intel, "interval", hours=2, id="news-intel")

        # Phase 3: Backtest Engine nachts 02:00 UTC
        scheduler.add_job(run_backtests, "cron", hour=2, minute=0, id="backtest",
                          misfire_grace_time=3600)

        # Erster Lauf kurz nach Start (damit sofort Daten da sind)
        soon = datetime.now(timezone.utc)
        scheduler.add_job(run_data_collector, "date", run_date=soon + timedelta(seconds=30))
        scheduler.add_job(run_news_intel, "date", run_date=soon + timedelta(seconds=90))

        # Phase 4: AI Learning täglich 03:30 UTC (nach dem 02:00-Backtest)
        scheduler.add_job(run_ai_learning, "cron", hour=3, minute=30, id="ai-learning",
                          misfire_grace_time=3600)

        # Stufe 1A: Verbesserungs-Vorschläge — WÖCHENTLICH Sonntag 04:00 UTC
        # (User-Vorgabe 12.07.: Methoden 1+ Wochen testen statt täglicher Flut;
        #  Daten-Sammlung darunter läuft weiter täglich)
        scheduler.add_job(run_recommendations, "cron", day_of_week="sun", hour=4, minute=0,
                          id="recommendations", misfire_grace_time=3600)

        # Auswertungs-Reports: Woche (So 06:00) + Monat (1. um 06:30)
        from services.periodic_report import run_weekly_report, run_monthly_report
        scheduler.add_job(run_weekly_report, "cron", day_of_week="sun", hour=6, minute=0,
                          id="weekly-report", misfire_grace_time=3600)
        scheduler.add_job(run_monthly_report, "cron", day=1, hour=6, minute=30,
                          id="monthly-report", misfire_grace_time=3600)

        scheduler.start()
        logger.info("Scheduler gestartet — data-collector (4h), news-intel (2h), backtest (02:00), ai-learning (03:30)")
    except Exception as e:
        logger.error(f"Scheduler-Start fehlgeschlagen (non-fatal): {e}")

    yield

    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler gestoppt")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Autonome Analyse: Backtesting, Forward-Testing, News-Intelligence, AI Learning",
    lifespan=lifespan,
    # Öffentliche API-Doku deaktiviert (Sicherheit) — Endpoints bleiben nutzbar
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def api_key_guard(request, call_next):
    """Schützt /api/v1/* mit X-Analysis-Key Header.
    ANALYSIS_API_KEY leer → alles offen (Fallback: nichts bricht ohne Config).
    /health bleibt immer offen (UptimeRobot)."""
    if settings.ANALYSIS_API_KEY and request.url.path.startswith("/api/"):
        if request.headers.get("X-Analysis-Key") != settings.ANALYSIS_API_KEY:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=401, content={"error": "unauthorized"})
    return await call_next(request)

app.include_router(health.router)
app.include_router(insights.router, prefix="/api/v1")
app.include_router(data.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "insights": "/api/v1/insights",
            "trade_stats": "/api/v1/trade-stats",
            "news": "/api/v1/news",
            "backtests": "/api/v1/backtests",
        },
        "phase": "4 — AI Learning Manager aktiv (täglich 03:30 UTC, Telegram-Report)",
    }
