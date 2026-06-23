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
    return finbert_analyze_text(req.text)


@router.get("/analyze/{symbol}")
async def analyze_symbol(symbol: str):
    return finbert_symbol_sentiment(symbol)


@router.post("/analyze/multi")
async def analyze_multi(req: MultiRequest):
    return {"results": finbert_multi_symbol(req.symbols)}
