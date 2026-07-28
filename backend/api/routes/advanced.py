"""
Advanced Analysis API — Phase 3
GET  /api/v1/advanced/analyze/{symbol}
POST /api/v1/advanced/analyze/multi
"""

import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from services.advanced_analysis import advanced_analyze

router = APIRouter()

class MultiRequest(BaseModel):
    symbols: list[str]

@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    # run_in_executor: GARCH/XGBoost ist CPU-lastig und blockierte bisher den
    # Event-Loop für alle anderen Requests (Fund #6-Muster, 27.07.).
    return await asyncio.get_event_loop().run_in_executor(None, advanced_analyze, symbol)

@router.post("/analyze/multi")
async def analyze_multi(req: MultiRequest):
    symbols = req.symbols[:10]
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(*[loop.run_in_executor(None, advanced_analyze, sym) for sym in symbols])
    return {"results": list(results)}
