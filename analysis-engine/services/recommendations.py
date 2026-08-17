"""
Recommendation Engine (Stufe 1, Teil A) — läuft täglich 04:00 UTC.

Generiert KONKRETE, regelbasierte Verbesserungs-Vorschläge pro Symbol aus
Backtest + Live-Performance. Kein Claude nötig (funktioniert ohne API-Guthaben).

WICHTIG: Vorschläge werden NUR gemeldet (Redis + Telegram) — angewendet wird
nichts automatisch. Der Admin bestätigt einzeln per Telegram /apply SYMBOL
(Teil B, destinate-Webhook). Erst bestätigte Overrides liest der Orchestrator
(Teil C).

Regeln für einen Vorschlag (konservativ, alle müssen erfüllt sein):
  - Live: Symbol hat in 30 Tagen verloren (PnL < 0) bei >= 3 Trades
  - Backtest: beste Variante hat ProfitFactor >= 1.4 und >= 10 Trades
  - Dann: Vorschlag = Strategie-Typ + SL/TP-Prozente der besten Variante
"""

from datetime import datetime, timezone, timedelta

from loguru import logger

from services.storage import redis_get_json, redis_set_json

REDIS_KEY_RECOMMENDATIONS = "analysis:recommendations"
REDIS_KEY_TRADE_STATS = "analysis:trade_stats"
REDIS_KEY_BACKTESTS = "analysis:backtests"
REDIS_KEY_WALKFORWARD = "analysis:walkforward"

# Sieben Tage — DIESELBE Grenze, die insights-reader.ts im Frontend benutzt
# (WF_MAX_AGE_MS). Bewusst keine neue Zahl: beide Seiten sollen dasselbe
# Ergebnis fuer "zu alt" liefern, sonst widersprechen sie sich erneut.
WALKFORWARD_MAX_ALTER = timedelta(days=7)
TTL = 8 * 24 * 60 * 60  # 8 Tage — Vorschläge kommen wöchentlich (So 04:00), /apply braucht sie die ganze Woche

# Backtest-Strategie → Trading-Style den destinate kennt
STRATEGY_TO_STYLE = {
    "EMA_CROSS": "DAYTRADING",     # Trendfolge
    "RSI_REVERSION": "SCALPING",   # schnelle Gegenbewegung
    "BREAKOUT": "SWING",           # Ausbruch, weiter Horizont
}

MIN_LIVE_TRADES = 3
MIN_BT_TRADES = 10
MIN_BT_PROFIT_FACTOR = 1.4


def _ueberangepasste_symbole() -> set[str]:
    """Symbole, fuer die der Walk-Forward Ueberanpassung meldet (09.08.).

    ANLASS, belegt aus dem Telegram-Bericht vom 09.08.: ALLE DREI Vorschlaege
    des Tages (DJ30, USDCAD, UK100) standen im selben Wochen-Report unter
    "Overfitting-Verdacht". Der Vorschlag fuer UK100 berief sich sogar auf
    "PF 4.11 bei 16 Trades" — genau die In-Sample-Zahl, vor der der
    Walk-Forward warnt.

    Grund: diese Datei las nur trade_stats und backtests. Der Walk-Forward
    existierte, wurde aber nie gefragt. Zwei Systeme, die sich widersprechen,
    und der Nutzer bekam beide Aussagen nebeneinander praesentiert.

    Bei fehlendem, laufendem oder zu altem Ergebnis kommt eine LEERE Menge
    zurueck — dann verhaelt sich alles wie bisher. Ein fehlender Walk-Forward
    darf die Vorschlaege nicht stillegen.
    """
    wf = redis_get_json(REDIS_KEY_WALKFORWARD) or {}
    if wf.get("status") != "done" or not wf.get("updatedAt"):
        return set()
    try:
        stand = datetime.fromisoformat(str(wf["updatedAt"]).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return set()
    if stand.tzinfo is None:
        stand = stand.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - stand > WALKFORWARD_MAX_ALTER:
        logger.info("[recommendations] Walk-Forward zu alt — kein Robustheits-Filter")
        return set()
    return {str(x) for x in (wf.get("overfitWarningSymbols") or [])}


def _build_recommendations() -> tuple[list[dict], list[str]]:
    """(Vorschlaege, wegen Ueberanpassung zurueckgehaltene Symbole)"""
    stats = redis_get_json(REDIS_KEY_TRADE_STATS) or {}
    backtests = redis_get_json(REDIS_KEY_BACKTESTS) or {}
    ueberangepasst = _ueberangepasste_symbole()

    live_markets = (stats.get("last30d") or {}).get("byMarket") or {}
    best = backtests.get("bestPerSymbol") or {}

    recs = []
    zurueckgehalten: list[str] = []
    for symbol, bt in best.items():
        live = live_markets.get(symbol)
        if not live:
            continue
        # Regel 1: Live verliert bei genug Stichprobe
        if not (live.get("pnl", 0) < 0 and live.get("trades", 0) >= MIN_LIVE_TRADES):
            continue
        # Regel 2: Backtest-Alternative ist solide
        if not (bt.get("profitFactor", 0) >= MIN_BT_PROFIT_FACTOR
                and bt.get("trades", 0) >= MIN_BT_TRADES):
            continue

        # Regel 3 (09.08.): der Walk-Forward muss dem Backtest nicht
        # widersprechen. Der Vorschlag beruht auf der In-Sample-Zahl — genau
        # die ist bei Ueberanpassungsverdacht nicht belastbar.
        if symbol in ueberangepasst:
            zurueckgehalten.append(symbol)
            logger.info(
                f"[recommendations] {symbol} zurueckgehalten — Walk-Forward meldet "
                f"Ueberanpassung (Backtest PF {bt.get('profitFactor')} waere sonst "
                f"vorgeschlagen worden)"
            )
            continue

        recs.append({
            "symbol": symbol,
            "reason": (
                f"Live 30d: {live.get('trades')} Trades, "
                f"WR {live.get('winRate')}%, PnL {live.get('pnl')}"
            ),
            "suggestion": {
                "style": STRATEGY_TO_STYLE.get(bt.get("strategy", ""), "DAYTRADING"),
                "strategy": bt.get("strategy"),
                "slPct": bt.get("sl"),   # z.B. 0.01 = 1% vom Preis
                "tpPct": bt.get("tp"),
            },
            "evidence": (
                f"Backtest 3mo: {bt.get('strategy')} {bt.get('params')} "
                f"WR {bt.get('winRate')}%, PF {bt.get('profitFactor')}, "
                f"{bt.get('trades')} Trades"
            ),
            "status": "PROPOSED",  # wird durch /apply zu APPLIED (Teil B)
        })

    # Stärkste Verlierer zuerst
    def live_pnl(r: dict) -> float:
        m = live_markets.get(r["symbol"]) or {}
        return m.get("pnl", 0)
    recs.sort(key=live_pnl)
    return recs[:8], zurueckgehalten  # max 8 Vorschläge pro Tag — überschaubar bleiben


def _send_telegram(recs: list[dict], zurueckgehalten: list[str]) -> None:
    from core.config import settings
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID):
        return
    import httpx

    if not recs and not zurueckgehalten:
        return  # nichts zu melden = keine Nachricht (kein Spam)

    lines = ["🔧 <b>Analysis Engine — Verbesserungs-Vorschläge</b>",
             "<i>Nichts wird automatisch geändert. Bestätige einzeln mit /apply SYMBOL</i>", ""]
    if not recs:
        lines.append("Keine Vorschläge, die den Robustheits-Check bestehen.")
        lines.append("")
    for r in recs:
        s = r["suggestion"]
        lines.append(f"• <b>{r['symbol']}</b> → {s['strategy']} als {s['style']}, "
                     f"SL {s['slPct']*100:.0f}% / TP {s['tpPct']*100:.0f}%")
        lines.append(f"  Grund: {r['reason']}")
        lines.append(f"  Beleg: {r['evidence']}")
        lines.append("")
    if zurueckgehalten:
        # NICHT verschweigen: der Nutzer soll wissen, dass es Kandidaten gab und
        # warum sie nicht empfohlen werden. Am 09.08. waren ALLE DREI Vorschlaege
        # Maerkte, die derselbe Wochen-Report als ueberangepasst fuehrte.
        lines.append(f"⚠️ <b>Zurückgehalten ({len(zurueckgehalten)}):</b> "
                     f"{', '.join(sorted(zurueckgehalten))}")
        lines.append("<i>Backtest wäre gut genug, aber der Walk-Forward meldet für diese "
                     "Märkte Überanpassung — der Vorschlag beruht auf genau der Zahl, "
                     "vor der gewarnt wird.</i>")
        lines.append("")
    lines.append("Befehle: /vorschlaege — Liste | /apply SYMBOL — anwenden | /unapply SYMBOL — zurücknehmen")

    try:
        httpx.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": "\n".join(lines), "parse_mode": "HTML"},
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"[recommendations] Telegram fehlgeschlagen: {e}")


def run_recommendations() -> None:
    logger.info("[recommendations] Zyklus gestartet")
    recs, zurueckgehalten = _build_recommendations()

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "recommendations": recs,
        # Sichtbar mitgeben, nicht nur im Log: wer die Liste ueber /vorschlaege
        # abruft, soll auch die zurueckgehaltenen sehen.
        "zurueckgehaltenWegenUeberanpassung": zurueckgehalten,
    }
    ok = redis_set_json(REDIS_KEY_RECOMMENDATIONS, payload, TTL)
    logger.info(
        f"[recommendations] {len(recs)} Vorschläge, "
        f"{len(zurueckgehalten)} wegen Überanpassung zurückgehalten — "
        f"Redis={'ok' if ok else 'FEHLER'}"
    )

    _send_telegram(recs, zurueckgehalten)
