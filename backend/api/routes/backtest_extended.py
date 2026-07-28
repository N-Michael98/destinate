import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from services.backtesting_extended import run_ema_crossover_backtest, get_performance_report

router = APIRouter()

class BacktestRequest(BaseModel):
    symbol: str
    fast: int = 20
    slow: int = 50

@router.post("/ema-crossover")
async def backtest_ema(req: BacktestRequest):
    # run_in_executor: vectorbt-Backtest ist blockierend (Fund #6-Muster, 27.07.)
    return await asyncio.get_event_loop().run_in_executor(
        None, run_ema_crossover_backtest, req.symbol, req.fast, req.slow
    )

@router.get("/performance/{symbol}")
async def performance_report(symbol: str):
    return await asyncio.get_event_loop().run_in_executor(None, get_performance_report, symbol)
