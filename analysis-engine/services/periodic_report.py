"""
Wochen- & Monats-Report — die Auswertungs-Ebene der Analysis Engine.

Philosophie (User-Vorgabe 2026-07-12): Die Engine sammelt täglich Verlauf
(Backtests, Trade-Stats, News — unverändert), aber die AUSWERTUNG kommt
periodisch: Methoden 1+ Wochen laufen lassen, dann anhand der Bilanz
entscheiden ob /apply-Overrides bleiben, angepasst oder ersetzt werden.

- Wochen-Report: Sonntag 06:00 UTC — 7 Tage vs. Vorwoche, pro Symbol,
  Override-Symbole separat ausgewiesen
- Monats-Report: am 1. um 06:30 UTC — 30-Tage-Gesamtbild

Nur lesend (PG Trade + Redis) + Telegram. Kein Einfluss aufs Trading.
"""

from datetime import datetime, timezone

import httpx
from loguru import logger

from core.config import settings
from services.storage import pg_query, redis_get_json


def _stats_for_window(days_back_start: int, days_back_end: int) -> dict:
    """Aggregierte Trade-Stats für ein Zeitfenster (z.B. 7..0 = letzte Woche).
    days_back_start > days_back_end, beide in Tagen vor jetzt."""
    rows = pg_query(
        '''SELECT market, result, "profitLoss"
           FROM "Trade"
           WHERE status = 'CLOSED'
             AND "updatedAt" >= NOW() - INTERVAL '%s days'
             AND "updatedAt" <  NOW() - INTERVAL '%s days' ''' % (int(days_back_start), int(days_back_end))
    )
    by_symbol: dict[str, dict] = {}
    total = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0}
    for market, result, pnl in rows:
        pnl = float(pnl or 0)
        e = by_symbol.setdefault(market or "?", {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0})
        for b in (e, total):
            b["trades"] += 1
            if result == "WIN":
                b["wins"] += 1
            elif result == "LOSS":
                b["losses"] += 1
            b["pnl"] = round(b["pnl"] + pnl, 2)
    decided = total["wins"] + total["losses"]
    total["winRate"] = round(total["wins"] / decided * 100, 1) if decided else None
    return {"total": total, "bySymbol": by_symbol}


def _fmt_total(t: dict) -> str:
    wr = f"{t['winRate']}%" if t.get("winRate") is not None else "n/a"
    sign = "+" if t["pnl"] >= 0 else ""
    return f"{t['trades']} Trades | WR {wr} | PnL {sign}{t['pnl']}"


def _send(text: str) -> None:
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID):
        return
    try:
        httpx.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"[report] Telegram fehlgeschlagen: {e}")


def _build_report(days: int, title: str, compare_previous: bool) -> str:
    current = _stats_for_window(days, 0)
    lines = [f"📊 <b>{title}</b>", ""]
    lines.append(f"<b>Gesamt ({days} Tage):</b> {_fmt_total(current['total'])}")

    if compare_previous:
        previous = _stats_for_window(days * 2, days)
        if previous["total"]["trades"] > 0:
            lines.append(f"<b>Vorperiode:</b> {_fmt_total(previous['total'])}")
            delta = round(current["total"]["pnl"] - previous["total"]["pnl"], 2)
            arrow = "📈" if delta >= 0 else "📉"
            lines.append(f"{arrow} Veränderung PnL: {'+' if delta >= 0 else ''}{delta}")
    lines.append("")

    # Pro Symbol, sortiert nach PnL
    ranked = sorted(current["bySymbol"].items(), key=lambda kv: kv[1]["pnl"])
    overrides = redis_get_json("analysis:applied_overrides") or {}

    if ranked:
        lines.append("<b>Symbole (Verlierer → Gewinner):</b>")
        for sym, e in ranked:
            decided = e["wins"] + e["losses"]
            wr = f"{round(e['wins'] / decided * 100)}%" if decided else "n/a"
            mark = " 🔧" if sym.upper() in overrides else ""
            sign = "+" if e["pnl"] >= 0 else ""
            lines.append(f"• {sym}{mark}: {e['trades']} Trades, WR {wr}, {sign}{e['pnl']}")
        lines.append("")

    if overrides:
        lines.append(f"🔧 = aktiver Override ({', '.join(overrides.keys())})")
        lines.append("Bilanz gut → behalten | schlecht → /unapply + neue /vorschlaege prüfen")
        lines.append("")

    lines.append(f"🕐 {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC")
    return "\n".join(lines)


def run_weekly_report() -> None:
    logger.info("[report] Wochen-Report gestartet")
    _send(_build_report(7, "Wochen-Report — Analysis Engine", compare_previous=True))
    logger.info("[report] Wochen-Report gesendet")


def run_monthly_report() -> None:
    logger.info("[report] Monats-Report gestartet")
    _send(_build_report(30, "Monats-Report — Analysis Engine", compare_previous=True))
    logger.info("[report] Monats-Report gesendet")
