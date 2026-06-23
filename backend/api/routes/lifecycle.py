"""
Trade Lifecycle API Routes
Next.js ruft diese Endpoints auf um Trades zu registrieren + Preis-Updates zu senden.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from services.trade_lifecycle_manager import lifecycle, TradeState
from services.market_mapper import symbol_to_ic, capital_epic_to_symbol

router = APIRouter(prefix="/lifecycle", tags=["Trade Lifecycle"])

class TradeRegisterRequest(BaseModel):
    trade_id:      str
    symbol:        str
    direction:     str
    entry:         float
    stop_loss:     float = 0
    take_profit:   float = 0
    size:          float = 1
    confidence:    int   = 72
    trading_style: str   = "DAYTRADING"
    broker:        str   = "Capital.com"
    opened_at:     Optional[str] = None

class PriceUpdateRequest(BaseModel):
    trade_id:      str
    current_price: float

class TradeCloseRequest(BaseModel):
    trade_id: str
    pnl:      float = 0
    reason:   str   = "CLOSED"

class BalanceUpdateRequest(BaseModel):
    balance: float

@router.post("/register")
def register_trade(body: TradeRegisterRequest):
    opened = None
    if body.opened_at:
        try:
            opened = datetime.fromisoformat(body.opened_at.replace("Z", "+00:00"))
        except Exception:
            pass

    trade = TradeState(
        trade_id      = body.trade_id,
        symbol        = body.symbol,
        direction     = body.direction,
        entry         = body.entry,
        stop_loss     = body.stop_loss,
        take_profit   = body.take_profit,
        size          = body.size,
        confidence    = body.confidence,
        trading_style = body.trading_style,
        broker        = body.broker,
        opened_at     = opened,
    )
    lifecycle.register_trade(trade)
    return {"ok": True, "trade_id": body.trade_id}

@router.post("/price-update")
async def price_update(body: PriceUpdateRequest):
    action = await lifecycle.on_price_update(body.trade_id, body.current_price)
    return {"ok": True, "action": action}

@router.post("/close")
def close_trade(body: TradeCloseRequest):
    lifecycle.remove_trade(body.trade_id, body.pnl, body.reason)
    return {"ok": True}

@router.post("/balance")
def update_balance(body: BalanceUpdateRequest):
    lifecycle.set_balance(body.balance)
    return {"ok": True}

@router.get("/trades")
def get_all_trades():
    return {"trades": lifecycle.get_all_trades()}

@router.get("/trades/{trade_id}")
def get_trade(trade_id: str):
    t = lifecycle.get_trade(trade_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trade nicht gefunden")
    return t

@router.get("/stats")
def get_stats():
    return lifecycle.get_stats()
