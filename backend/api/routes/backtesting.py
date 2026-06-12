from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.backtesting import run_backtest, run_all_strategies

router = APIRouter(prefix="/backtest", tags=["Backtesting"])

class BacktestRequest(BaseModel):
    symbol:          str
    interval:        str   = Field("1h",    description="1h 4h 1d")
    period:          str   = Field("6mo",   description="1mo 3mo 6mo 1y")
    strategy:        str   = Field("rsi",   description="rsi | macd | ema | bb | multi")
    rsi_oversold:    float = Field(30.0, ge=10, le=45)
    rsi_overbought:  float = Field(70.0, ge=55, le=90)
    sl_pct:          float = Field(0.01, ge=0.001, le=0.05)
    tp_pct:          float = Field(0.02, ge=0.002, le=0.10)
    initial_balance: float = Field(10000.0, ge=100)

class AllStrategiesRequest(BaseModel):
    symbol:          str
    interval:        str   = Field("1h",   description="1h 4h 1d")
    period:          str   = Field("3mo",  description="1mo 3mo 6mo 1y")
    initial_balance: float = Field(10000.0, ge=100)

@router.post("/run")
def backtest(body: BacktestRequest):
    try:
        result = run_backtest(
            symbol=body.symbol,
            interval=body.interval,
            period=body.period,
            strategy=body.strategy,
            rsi_oversold=body.rsi_oversold,
            rsi_overbought=body.rsi_overbought,
            sl_pct=body.sl_pct,
            tp_pct=body.tp_pct,
            initial_balance=body.initial_balance,
        )
        if "error" in result and not result.get("trades") == []:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run-all")
def backtest_all(body: AllStrategiesRequest):
    """Alle 5 Strategien auf einmal — für Strategy Evolution Vergleich."""
    try:
        results = run_all_strategies(
            symbol=body.symbol,
            interval=body.interval,
            period=body.period,
            initial_balance=body.initial_balance,
        )
        return {
            "symbol":   body.symbol,
            "interval": body.interval,
            "period":   body.period,
            "results":  results,
            "best":     max((r for r in results if "win_rate" in r), key=lambda r: r.get("profit_factor", 0), default=None),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
