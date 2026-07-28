import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from services.finbert_sentiment import finbert_analyze_text, finbert_symbol_sentiment, finbert_multi_symbol

router = APIRouter()


class TextRequest(BaseModel):
    text: str


class MultiRequest(BaseModel):
    symbols: list[str]


@router.post("/analyze/text")
async def analyze_text(req: TextRequest):
    # run_in_executor: FinBERT-Inferenz + evtl. Cold-Model-Load ist blockierend,
    # sonst friert der Event-Loop für alle anderen Requests ein (Fund #6-Muster).
    return await asyncio.get_event_loop().run_in_executor(None, finbert_analyze_text, req.text)


@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    return await asyncio.get_event_loop().run_in_executor(None, finbert_symbol_sentiment, symbol)


@router.post("/analyze/multi")
async def analyze_multi(req: MultiRequest):
    results = await asyncio.get_event_loop().run_in_executor(None, finbert_multi_symbol, req.symbols)
    return {"results": results}
