import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from services.sentiment_analysis import symbol_sentiment, multi_symbol_sentiment, fetch_headlines

router = APIRouter()

class MultiRequest(BaseModel):
    symbols: list[str]

@router.get("/analyze/{symbol}")
async def sentiment_symbol(symbol: str):
    # run_in_executor: RSS-Fetch + VADER blockierend (Fund #6-Muster, 27.07.)
    return await asyncio.get_event_loop().run_in_executor(None, symbol_sentiment, symbol)

@router.post("/analyze/multi")
async def sentiment_multi(req: MultiRequest):
    results = await asyncio.get_event_loop().run_in_executor(None, multi_symbol_sentiment, req.symbols[:10])
    return {"results": results}

@router.get("/headlines")
async def get_headlines():
    headlines = await asyncio.get_event_loop().run_in_executor(None, fetch_headlines, 3)
    return {"headlines": headlines}
