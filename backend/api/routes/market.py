from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from services.market_data import get_current_price, get_ohlcv, get_multi_price, SYMBOL_MAP

router = APIRouter(prefix="/market", tags=["Market Data"])

class MultiPriceRequest(BaseModel):
    symbols: list[str]

@router.get("/price/{symbol}")
def price(symbol: str):
    try:
        return get_current_price(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/price/multi")
def multi_price(body: MultiPriceRequest):
    return {"prices": get_multi_price(body.symbols)}

@router.get("/ohlcv/{symbol}")
def ohlcv(
    symbol: str,
    interval: str = Query("1h", description="1m 5m 15m 30m 1h 4h 1d 1wk"),
    period:   str = Query("5d", description="1d 5d 1mo 3mo 6mo 1y 2y"),
):
    try:
        candles = get_ohlcv(symbol, interval, period)
        return {"symbol": symbol.upper(), "interval": interval, "period": period, "candles": candles, "count": len(candles)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/symbols")
def supported_symbols():
    return {"symbols": list(SYMBOL_MAP.keys()), "count": len(SYMBOL_MAP)}
