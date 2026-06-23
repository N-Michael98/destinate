"""
Advanced Analysis API — Phase 3
GET  /api/v1/advanced/analyze/{symbol}
POST /api/v1/advanced/analyze/multi
"""

from fastapi import APIRouter
from pydantic import BaseModel
from services.advanced_analysis import advanced_analyze

router = APIRouter()

class MultiRequest(BaseModel):
    symbols: list[str]

@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    return advanced_analyze(symbol)

@router.post("/analyze/multi")
async def analyze_multi(req: MultiRequest):
    results = []
    for sym in req.symbols[:10]:
        results.append(advanced_analyze(sym))
    return {"results": results}
