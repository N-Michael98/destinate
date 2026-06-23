from fastapi import APIRouter
from pydantic import BaseModel
from core.circuit_breaker import get_all_status
from services.fast_analytics import fast_indicators, fast_multi_symbol, fast_correlation_matrix

router = APIRouter()


class MultiRequest(BaseModel):
    symbols: list[str]
    interval: str = "1d"


class CorrelationRequest(BaseModel):
    symbols: list[str]
    period: str = "3mo"


# ── Circuit Breaker ────────────────────────────────────────────────────────────

@router.get("/circuit-breakers")
def circuit_breaker_status():
    return get_all_status()


# ── Polars Fast Analytics ──────────────────────────────────────────────────────

@router.get("/fast/analyze/{symbol}")
def fast_analyze(symbol: str, interval: str = "1d"):
    return fast_indicators(symbol, interval)


@router.post("/fast/analyze/multi")
def fast_analyze_multi(req: MultiRequest):
    return {"results": fast_multi_symbol(req.symbols, req.interval)}


@router.post("/fast/correlation")
def fast_correlation(req: CorrelationRequest):
    return fast_correlation_matrix(req.symbols, req.period)
