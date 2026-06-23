"""
Telegram Alerts — Python Backend Service
Zwei Kanäle: Alerts (Trades/Fehler) + Journal (tägl. Zusammenfassung)
Kill Switch + Drawdown Monitor eingebaut.
Abonniert Event Bus Events automatisch.
"""

import os
import logging
import httpx
from datetime import datetime, timezone
from core.event_bus import bus, EventType, Event

logger = logging.getLogger(__name__)

BOT_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID     = os.environ.get("TELEGRAM_CHAT_ID", "")
JOURNAL_ID  = os.environ.get("TELEGRAM_JOURNAL_CHAT_ID", CHAT_ID)

def _configured() -> bool:
    return len(BOT_TOKEN) > 10 and len(CHAT_ID) > 3

def _zurich_time() -> str:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Europe/Zurich")).strftime("%d.%m.%Y %H:%M:%S")

async def _send(text: str, chat_id: str = "") -> bool:
    if not _configured():
        return False
    target = chat_id or CHAT_ID
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": target, "text": text, "parse_mode": "HTML"},
            )
            return res.json().get("ok", False)
    except Exception as e:
        logger.error(f"[telegram] Sende-Fehler: {e}")
        return False

# ── Trade Alerts ──────────────────────────────────────────────────────────────

async def alert_trade_opened(data: dict) -> None:
    symbol    = data.get("symbol", "?")
    direction = data.get("direction", "?")
    entry     = data.get("entry", 0)
    sl        = data.get("stop_loss", 0)
    tp        = data.get("take_profit", 0)
    size      = data.get("size", 0)
    confidence = data.get("confidence", 0)
    broker    = data.get("broker", "?")
    style     = data.get("trading_style", "?")
    rr = round(abs(tp - entry) / abs(entry - sl), 1) if sl and tp and entry else "?"

    dir_emoji = "🟢" if direction == "BUY" else "🔴"
    await _send(
f"""📈 <b>Trade ausgeführt</b>

{dir_emoji} <b>{symbol}</b> {direction}
🏦 Broker: {broker}
📊 Grösse: {size} Units
🎯 Entry: {entry}
🛑 SL: {sl}
✅ TP: {tp}
⚖️ R:R = 1:{rr}
🤖 Confidence: {confidence}%
📋 Stil: {style}
🕐 {_zurich_time()}"""
    )

async def alert_trade_closed(data: dict) -> None:
    symbol = data.get("symbol", "?")
    pnl    = data.get("pnl", 0)
    reason = data.get("reason", "?")
    broker = data.get("broker", "?")
    emoji  = "✅" if pnl >= 0 else "❌"
    sign   = "+" if pnl >= 0 else ""

    await _send(
f"""{emoji} <b>Trade geschlossen — {reason}</b>

📉 {symbol}
🏦 Broker: {broker}
💰 P&L: <b>{sign}{pnl:.2f} CHF</b>
🕐 {_zurich_time()}"""
    )

async def alert_breakeven(data: dict) -> None:
    symbol = data.get("symbol", "?")
    entry  = data.get("entry", 0)
    broker = data.get("broker", "?")
    await _send(
f"""⚡ <b>Breakeven gesetzt</b>

{symbol}
🏦 Broker: {broker}
📍 SL → Entry: {entry}
🕐 {_zurich_time()}"""
    )

async def alert_partial_tp(data: dict) -> None:
    symbol   = data.get("symbol", "?")
    closed   = data.get("closed_volume", 0)
    remaining = data.get("remaining_volume", 0)
    pnl      = data.get("pnl", 0)
    await _send(
f"""💰 <b>Partial TP ausgeführt</b>

{symbol}
📊 Geschlossen: {closed} Units (+{pnl:.2f} CHF)
📊 Rest offen: {remaining} Units
🕐 {_zurich_time()}"""
    )

async def alert_zeit_exit(data: dict) -> None:
    symbol = data.get("symbol", "?")
    age_h  = data.get("age_hours", 0)
    style  = data.get("trading_style", "?")
    pnl    = data.get("pnl", 0)
    sign   = "+" if pnl >= 0 else ""
    await _send(
f"""⏰ <b>Zeit-Exit ausgeführt</b>

{symbol} ({style})
⏱ Alter: {age_h:.1f}h
💰 P&L: {sign}{pnl:.2f} CHF
🕐 {_zurich_time()}"""
    )

# ── Drawdown + Kill Switch ────────────────────────────────────────────────────

async def alert_drawdown(data: dict) -> None:
    current  = data.get("current_balance", 0)
    start    = data.get("start_balance", 0)
    drawdown = data.get("drawdown_pct", 0)
    await _send(
f"""⚠️ <b>Drawdown Alert</b>

💰 Start: {start:.2f} CHF
💸 Aktuell: {current:.2f} CHF
📉 Drawdown: -{drawdown:.1f}%
🕐 {_zurich_time()}"""
    )

async def alert_killswitch(data: dict) -> None:
    reason = data.get("reason", "Manuell")
    await _send(
f"""🚨 <b>KILL SWITCH AKTIVIERT</b>

⛔ Alle Trades gestoppt
📋 Grund: {reason}
🕐 {_zurich_time()}"""
    )

async def alert_error(data: dict) -> None:
    message = data.get("message", "?")
    source  = data.get("source", "?")
    await _send(
f"""❌ <b>System Fehler</b>

📋 {message}
🔍 Quelle: {source}
🕐 {_zurich_time()}"""
    )

# ── Journal (tägl. Zusammenfassung) ──────────────────────────────────────────

async def send_daily_journal(data: dict) -> None:
    trades  = data.get("trades", 0)
    wins    = data.get("wins", 0)
    losses  = data.get("losses", 0)
    total   = data.get("total_pnl", 0)
    win_rate = (wins / trades * 100) if trades else 0
    emoji   = "📈" if total >= 0 else "📉"
    sign    = "+" if total >= 0 else ""

    await _send(
f"""{emoji} <b>Tages-Zusammenfassung</b>

📊 Trades: {trades}
✅ Wins: {wins} | ❌ Losses: {losses}
🎯 Win Rate: {win_rate:.0f}%
💰 Gesamt P&L: <b>{sign}{total:.2f} CHF</b>
🕐 {_zurich_time()}""",
        chat_id=JOURNAL_ID,
    )

# ── Event Bus Subscriptions ───────────────────────────────────────────────────

async def _on_trade_opened(event: Event):  await alert_trade_opened(event.data)
async def _on_trade_closed(event: Event):  await alert_trade_closed(event.data)
async def _on_breakeven(event: Event):     await alert_breakeven(event.data)
async def _on_partial_tp(event: Event):    await alert_partial_tp(event.data)
async def _on_zeit_exit(event: Event):     await alert_zeit_exit(event.data)
async def _on_drawdown(event: Event):      await alert_drawdown(event.data)
async def _on_killswitch(event: Event):    await alert_killswitch(event.data)
async def _on_error(event: Event):         await alert_error(event.data)

def register_handlers() -> None:
    bus.subscribe(EventType.TRADE_OPENED,  _on_trade_opened)
    bus.subscribe(EventType.TRADE_CLOSED,  _on_trade_closed)
    bus.subscribe(EventType.BREAKEVEN_SET, _on_breakeven)
    bus.subscribe(EventType.PARTIAL_TP,    _on_partial_tp)
    bus.subscribe(EventType.ZEIT_EXIT,     _on_zeit_exit)
    bus.subscribe(EventType.DRAWDOWN_ALERT,_on_drawdown)
    bus.subscribe(EventType.KILLSWITCH,    _on_killswitch)
    bus.subscribe(EventType.ERROR,         _on_error)
    logger.info("[telegram] ✅ Alle Alert-Handler registriert")
