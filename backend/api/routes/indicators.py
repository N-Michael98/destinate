from fastapi import APIRouter, HTTPException, Query
from services.indicators import calculate_all

router = APIRouter(prefix="/indicators", tags=["Technical Indicators"])

@router.get("/{symbol}")
def indicators(
    symbol:   str,
    interval: str = Query("1h", description="1m 5m 15m 30m 1h 4h 1d"),
    period:   str = Query("3mo", description="1mo 3mo 6mo 1y"),
):
    try:
        result = calculate_all(symbol, interval, period)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
