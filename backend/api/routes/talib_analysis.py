from fastapi import APIRouter
from pydantic import BaseModel
from services.talib_indicators import analyze_talib, talib_pattern_scan

router = APIRouter()


class MultiRequest(BaseModel):
    symbols: list[str]
    interval: str = "1d"


@router.get("/analyze/{symbol}")
async def talib_analyze(symbol: str, interval: str = "1d"):
    return analyze_talib(symbol, interval)


@router.post("/analyze/multi")
async def talib_analyze_multi(req: MultiRequest):
    return {"results": [analyze_talib(s, req.interval) for s in req.symbols[:10]]}


@router.get("/patterns/{symbol}")
async def talib_patterns(symbol: str, interval: str = "1d"):
    return talib_pattern_scan(symbol, interval)
