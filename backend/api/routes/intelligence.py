"""
Market Intelligence API Routes
POST /api/v1/intelligence/analyze       → Ein Symbol analysieren
POST /api/v1/intelligence/analyze/multi → Mehrere Symbole
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.market_intelligence import analyze, analyze_multi

router = APIRouter(prefix="/intelligence", tags=["Market Intelligence"])

class AnalyzeRequest(BaseModel):
    symbol: str

class MultiAnalyzeRequest(BaseModel):
    symbols: list[str]

@router.post("/analyze")
def analyze_symbol(body: AnalyzeRequest):
    try:
        return analyze(body.symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/multi")
def analyze_multi_symbols(body: MultiAnalyzeRequest):
    if len(body.symbols) > 20:
        raise HTTPException(status_code=400, detail="Max 20 Symbole pro Anfrage")
    return {"results": analyze_multi(body.symbols)}

@router.get("/analyze/{symbol}")
def analyze_get(symbol: str):
    try:
        return analyze(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
