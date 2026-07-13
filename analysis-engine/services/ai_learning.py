"""
AI Learning Manager — läuft täglich 03:30 UTC (nach dem 02:00-Backtest).

Führt alles zusammen und lernt daraus:
  1. Forward-Test Validator: Live-Performance vs. Backtest-Erwartung pro Markt
  2. Claude bewertet: Diagnose + Lösungsvorschlag pro Problem-Markt
     (Philosophie: schlechte Performance = Wissenslücke, kein Verbot —
      Ziel ist verstehen und verbessern, nicht meiden)
  3. Ergebnis → Redis analysis:insights (für Orchestrator, Phase 5)
             → Telegram-Report an den Admin

Kosten: 1 Claude-Haiku-Call pro Tag (~0.02$).
"""

import json
from datetime import datetime, timezone

import httpx
from loguru import logger

from core.config import settings
from services.storage import redis_get_json, redis_set_json

REDIS_KEY_INSIGHTS = "analysis:insights"
REDIS_KEY_TRADE_STATS = "analysis:trade_stats"
REDIS_KEY_BACKTESTS = "analysis:backtests"
REDIS_KEY_NEWS = "analysis:news"
TTL = 30 * 60 * 60  # 30h


# ── 1. Forward-Test Validator ─────────────────────────────────────────────────

def _forward_test_comparison() -> list[dict]:
    """Live vs. Backtest pro Symbol — wo weicht die Realität ab?"""
    stats = redis_get_json(REDIS_KEY_TRADE_STATS) or {}
    backtests = redis_get_json(REDIS_KEY_BACKTESTS) or {}

    live_markets = (stats.get("last30d") or {}).get("byMarket") or {}
    best = backtests.get("bestPerSymbol") or {}

    rows = []
    for symbol in set(list(live_markets.keys()) + list(best.keys())):
        live = live_markets.get(symbol) or {}
        bt = best.get(symbol) or {}
        rows.append({
            "symbol": symbol,
            "liveTrades": live.get("trades", 0),
            "liveWinRate": live.get("winRate"),
            "livePnl": live.get("pnl", 0),
            "backtestStrategy": bt.get("strategy"),
            "backtestParams": bt.get("params"),
            "backtestWinRate": bt.get("winRate"),
            "backtestProfitFactor": bt.get("profitFactor"),
        })
    # Verlierer zuerst (grösster Handlungsbedarf)
    rows.sort(key=lambda r: (r["livePnl"] if r["livePnl"] is not None else 0))
    return rows


# ── 2. Claude-Analyse ─────────────────────────────────────────────────────────

def _build_prompt(comparison: list[dict], news: dict) -> str:
    # Nur relevante News-Essenz (Token sparen)
    news_brief = []
    for cur, cb in (news.get("centralBanks") or {}).items():
        s = cb.get("sentiment") or {}
        news_brief.append(f"{cur} ({cb.get('source')}): {s.get('label', '?')} | " +
                          "; ".join((cb.get("headlines") or [])[:2]))
    for g in (news.get("geopolitics") or []):
        if g.get("articleCount", 0) > 0:
            news_brief.append(f"GEO {g['topic']} ({g['articleCount']} Artikel, betrifft {','.join(g['affects'])})")

    return f"""Du bist der Learning-Manager eines automatisierten Trading-Systems (Capital.com Demo).

PHILOSOPHIE: Schlechte Performance = Wissenslücke. Märkte werden NICHT gemieden,
sondern diagnostiziert: Warum verliert der Markt live? Was zeigt der Backtest als Alternative?

LIVE (30 Tage) vs. NÄCHTLICHER BACKTEST (1h-Kerzen, 3 Monate):
{json.dumps(comparison, ensure_ascii=False)}

NEWS/GEOPOLITIK HEUTE:
{chr(10).join(news_brief) if news_brief else "keine relevanten News"}

Antworte NUR mit JSON (kein Markdown):
{{
  "symbolInsights": {{"SYMBOL": {{"score": 0-100, "diagnosis": "warum läuft es (nicht)", "fix": "konkrete Verbesserung"}}}},
  "topActions": ["die 3 wichtigsten konkreten Verbesserungen fürs System"],
  "newsWarnings": ["Markt-Warnungen aus News/Geopolitik, max 3"],
  "summary": "2-3 Sätze Gesamtbild auf Deutsch"
}}

Regeln:
- score = Handels-Qualität des Symbols aktuell (Live+Backtest kombiniert)
- diagnosis/fix nur für auffällige Symbole (max 8), kurz und konkret
- fix soll umsetzbar sein (Strategie-Wechsel, SL/TP-Anpassung, Style-Wechsel)"""


def _ask_claude(prompt: str, retry: bool = True) -> tuple[dict | None, str | None]:
    """(result, error) — error ist remote via /api/v1/insights sichtbar.
    Bei kaputtem JSON (Haiku ist nicht deterministisch): 1x Retry."""
    if not settings.ANTHROPIC_API_KEY:
        return None, "ANTHROPIC_API_KEY fehlt"
    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.AI_MODEL,
                "max_tokens": 2000,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        if resp.status_code != 200:
            err = f"Claude HTTP {resp.status_code}: {resp.text[:300]}"
            logger.warning(f"[ai-learning] {err}")
            return None, err
        body = resp.json()
        stop_reason = body.get("stop_reason")
        text = body["content"][0]["text"].strip()
        # JSON extrahieren (falls Markdown-Fences)
        text = text.replace("```json", "").replace("```", "").strip()
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            return None, f"Kein JSON in Antwort (stop={stop_reason}): {text[:200]}"
        try:
            return json.loads(text[start:end + 1]), None
        except json.JSONDecodeError as je:
            # Diagnose: abgeschnitten (stop=max_tokens) oder Formatfehler?
            err = f"JSON kaputt (stop={stop_reason}, len={len(text)}): {je} | Ende: ...{text[-120:]}"
            logger.warning(f"[ai-learning] {err}")
            if retry:
                logger.info("[ai-learning] Retry (Haiku nicht deterministisch)")
                return _ask_claude(prompt, retry=False)
            return None, err
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        logger.warning(f"[ai-learning] Claude-Call fehlgeschlagen: {err}")
        if retry:
            return _ask_claude(prompt, retry=False)
        return None, err


# ── 3. Telegram-Report ────────────────────────────────────────────────────────

def _send_telegram(text: str) -> None:
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID):
        return
    try:
        httpx.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
    except Exception as e:
        logger.warning(f"[ai-learning] Telegram fehlgeschlagen: {e}")


def _format_report(ai: dict, comparison: list[dict]) -> str:
    lines = ["🧠 <b>Analysis Engine — Täglicher Learning-Report</b>", ""]
    lines.append(ai.get("summary", ""))
    lines.append("")

    insights = ai.get("symbolInsights") or {}
    if insights:
        lines.append("<b>📊 Markt-Diagnosen:</b>")
        for sym, ins in list(insights.items())[:8]:
            lines.append(f"• <b>{sym}</b> (Score {ins.get('score', '?')}/100)")
            lines.append(f"  Diagnose: {ins.get('diagnosis', '')}")
            lines.append(f"  💡 Fix: {ins.get('fix', '')}")
        lines.append("")

    actions = ai.get("topActions") or []
    if actions:
        lines.append("<b>🎯 Top-Empfehlungen:</b>")
        for a in actions[:3]:
            lines.append(f"• {a}")
        lines.append("")

    warnings = ai.get("newsWarnings") or []
    if warnings:
        lines.append("<b>⚠️ News-Warnungen:</b>")
        for w in warnings[:3]:
            lines.append(f"• {w}")
        lines.append("")

    lines.append(f"🕐 {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC")
    return "\n".join(lines)


# ── Hauptfunktion ─────────────────────────────────────────────────────────────

def run_ai_learning() -> None:
    logger.info("[ai-learning] Zyklus gestartet")

    comparison = _forward_test_comparison()
    if not comparison:
        logger.warning("[ai-learning] Keine Daten (trade_stats/backtests fehlen) — übersprungen")
        return

    news = redis_get_json(REDIS_KEY_NEWS) or {}
    ai, ai_error = _ask_claude(_build_prompt(comparison, news))

    insights = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "forwardTest": comparison,
        "ai": ai,  # None wenn Claude nicht erreichbar — forwardTest bleibt nutzbar
        "aiError": ai_error,
    }
    ok = redis_set_json(REDIS_KEY_INSIGHTS, insights, TTL)
    logger.info(f"[ai-learning] Insights gespeichert — Redis={'ok' if ok else 'FEHLER'} | AI={'ok' if ai else 'FALLBACK'}")

    if ai:
        _send_telegram(_format_report(ai, comparison))
        logger.info("[ai-learning] Telegram-Report gesendet")
