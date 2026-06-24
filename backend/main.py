from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.routes import health, market, indicators, backtesting, dukascopy, events, lifecycle, intelligence, advanced, sentiment, backtest_extended, talib_analysis, finbert, system, strategies

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Destinate — AI Trading Backend: Marktdaten, Indikatoren, Backtesting",
)

# CORS — Next.js Frontend erlauben
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes registrieren
app.include_router(health.router)
app.include_router(market.router,      prefix="/api/v1")
app.include_router(indicators.router,  prefix="/api/v1")
app.include_router(backtesting.router, prefix="/api/v1")
app.include_router(dukascopy.router,   prefix="/api/v1")
app.include_router(events.router,      prefix="/api/v1")
app.include_router(lifecycle.router,    prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(advanced.router,         prefix="/api/v1/advanced")
app.include_router(sentiment.router,        prefix="/api/v1/sentiment")
app.include_router(backtest_extended.router, prefix="/api/v1/backtest/extended")
app.include_router(talib_analysis.router,   prefix="/api/v1/talib")
app.include_router(finbert.router,          prefix="/api/v1/finbert")
app.include_router(system.router,           prefix="/api/v1/system")
app.include_router(strategies.router,       prefix="/api/v1")

@app.on_event("startup")
async def startup():
    from services.telegram_alerts import register_handlers
    register_handlers()

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "endpoints": {
            "health":      "/health",
            "market":      "/api/v1/market",
            "indicators":  "/api/v1/indicators",
            "backtesting": "/api/v1/backtest",
            "dukascopy":   "/api/v1/dukascopy",
        },
    }
