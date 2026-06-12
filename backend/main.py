from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.routes import health, market, indicators, backtesting, dukascopy

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
