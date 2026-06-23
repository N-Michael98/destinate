from fastapi import APIRouter
from pydantic import BaseModel
from services.sentiment_analysis import symbol_sentiment, multi_symbol_sentiment, fetch_headlines

router = APIRouter()

class MultiRequest(BaseModel):
    symbols: list[str]

@router.get("/analyze/{symbol}")
async def sentiment_symbol(symbol: str):
    return symbol_sentiment(symbol)

@router.post("/analyze/multi")
async def sentiment_multi(req: MultiRequest):
    return {"results": multi_symbol_sentiment(req.symbols[:10])}

@router.get("/headlines")
async def get_headlines():
    return {"headlines": fetch_headlines(max_per_feed=3)}
