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
from api.routes import health, insights

scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: Scheduler für autonome Jobs starten."""
    global scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        scheduler = AsyncIOScheduler(timezone="UTC")

        # Phase 2+: Jobs werden hier registriert, z.B.:
        # scheduler.add_job(run_data_collector, "interval", hours=4)
        # scheduler.add_job(run_news_intel, "interval", hours=2)
        # scheduler.add_job(run_backtests, "cron", hour=2, minute=0)
        # scheduler.add_job(run_ai_learning, "cron", hour=5, minute=0)

        scheduler.start()
        logger.info("Scheduler gestartet (noch keine Jobs — Phase 1 Skeleton)")
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
)

app.include_router(health.router)
app.include_router(insights.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "insights": "/api/v1/insights",
        },
        "phase": "1 — Skeleton (Scheduler bereit, Module folgen)",
    }
