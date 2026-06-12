from fastapi import APIRouter, HTTPException, Query
from services.dukascopy import get_tick_data, ticks_to_ohlcv
import asyncio

router = APIRouter(prefix="/dukascopy", tags=["High-Res Data"])

SUPPORTED = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "XAUUSD", "BTCUSD", "USDCAD", "AUDUSD"]

@router.get("/ticks/{symbol}")
async def fetch_ticks(
    symbol: str,
    hours: int = Query(default=6, ge=1, le=72),
):
    sym = symbol.upper()
    if sym not in SUPPORTED:
        raise HTTPException(400, f"Symbol {sym} nicht unterstützt. Verfügbar: {SUPPORTED}")
    ticks = await asyncio.get_event_loop().run_in_executor(None, get_tick_data, sym, hours)
    if not ticks:
        raise HTTPException(404, f"Keine Daten für {sym}")
    return {
        "symbol": sym, "hours": hours,
        "tick_count": len(ticks),
        "first": ticks[0]["timestamp"],
        "last": ticks[-1]["timestamp"],
        "ticks": ticks[-500:],
        "source": "YFINANCE_1M",
    }

@router.get("/ohlcv/{symbol}")
async def fetch_ohlcv(
    symbol: str,
    hours: int = Query(default=24, ge=1, le=168),
    interval_minutes: int = Query(default=60, ge=1, le=1440),
):
    sym = symbol.upper()
    if sym not in SUPPORTED:
        raise HTTPException(400, f"Symbol {sym} nicht unterstützt")
    ticks = await asyncio.get_event_loop().run_in_executor(None, get_tick_data, sym, hours)
    candles = ticks_to_ohlcv(ticks, interval_minutes=interval_minutes)
    if not candles:
        raise HTTPException(404, f"Keine OHLCV-Daten für {sym}")
    return {
        "symbol": sym,
        "interval_minutes": interval_minutes,
        "candle_count": len(candles),
        "candles": candles,
        "source": "YFINANCE_1M_AGGREGATED",
    }
