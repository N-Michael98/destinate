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


def _exit_reason_breakdown(days: int) -> dict:
    """WinRate/PnL gruppiert nach AUSSTIEGSGRUND (07.08.).

    Der Tracker leitet ihn seit dem 07.08. aus dem echten Schlusskurs ab:
    ZIEL / STOP / DAZWISCHEN. Vorher stand dort eine fest verdrahtete Null.

    WARUM das im Bericht steht: der Wochen-Report vom 09.08. zeigte fuer die
    Stufe GOOD 66,7 % Treffer und trotzdem -9,82 PnL. Das heisst, die Verlierer
    sind groesser als die Gewinner — aber ob das an fruehen Ausstiegen, am
    Zeit-Exit oder an der Stop-Weite liegt, war mit den vorhandenen Daten NICHT
    zu beantworten. Diese Aufteilung beantwortet es.

    Alte Trades haben das Feld nicht; sie erscheinen als OHNE_ANGABE und
    verfaelschen die anderen Gruppen dadurch nicht.
    """
    import json as _json
    rows = pg_query(
        '''SELECT result, "profitLoss", notes
           FROM "Trade"
           WHERE status = 'CLOSED'
             AND "updatedAt" >= NOW() - INTERVAL '%s days' ''' % int(days)
    )
    gruende: dict[str, dict] = {}
    for result, pnl, notes in rows:
        grund = "OHNE_ANGABE"
        try:
            grund = str((_json.loads(notes) or {}).get("exitReason") or "OHNE_ANGABE")
        except Exception:
            pass
        e = gruende.setdefault(grund, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0})
        e["trades"] += 1
        if result == "WIN":
            e["wins"] += 1
        elif result == "LOSS":
            e["losses"] += 1
        e["pnl"] = round(e["pnl"] + float(pnl or 0), 2)
    for e in gruende.values():
        decided = e["wins"] + e["losses"]
        e["winRate"] = round(e["wins"] / decided * 100, 1) if decided else None
    return gruende


def _ai_manager_breakdown(days: int) -> dict:
    """WinRate/PnL gruppiert danach, WAS DER AI MANAGER an der Position tat (10.08.).

    WARUM das hier steht: der AI Manager darf seit dem 03.08. Breakeven-Puffer,
    Trailing-Abstand und Teilgewinn-Anteil an der Marktlage ausrichten — und
    er darf eine Massnahme mit SKIP ganz verhindern. Sein Grund (aiReason) ging
    bis zum 10.08. in eine Logzeile und in eine Event-Nutzlast, die NIEMAND
    liest. Es gab also keine Rueckkopplung: niemand konnte messen, ob ein SKIP
    oder ein ADJUST sich gelohnt hat. Die AI entschied, ohne je nachgerechnet
    zu werden.

    Seit dem 10.08. haelt der RiskAgent seine Entscheidungen in Trade.notes
    fest (aiZusammenfassung). Hier werden sie gegen das ERGEBNIS derselben
    Position gestellt — Entscheidung und Ausgang in einer Zeile.

    Gruppen:
      NUR_APPROVE  die AI hat nur zugestimmt (Regelwerte gegolten)
      MIT_ADJUST   sie hat mindestens einmal eigene Werte gesetzt
      MIT_SKIP     sie hat mindestens einmal eine Massnahme verhindert
      OHNE_ANGABE  Trades von vor dem 10.08. — verfaelschen nichts

    MIT_SKIP und MIT_ADJUST koennen sich ueberschneiden; SKIP gewinnt, weil das
    der staerkere Eingriff ist (die Massnahme fand gar nicht statt).
    """
    import json as _json
    rows = pg_query(
        '''SELECT result, "profitLoss", notes
           FROM "Trade"
           WHERE status = 'CLOSED'
             AND "updatedAt" >= NOW() - INTERVAL '%s days' ''' % int(days)
    )
    gruppen: dict[str, dict] = {}
    for result, pnl, notes in rows:
        gruppe = "OHNE_ANGABE"
        try:
            z = (_json.loads(notes) or {}).get("aiZusammenfassung") or {}
            if z:
                if int(z.get("SKIP") or 0) > 0:
                    gruppe = "MIT_SKIP"
                elif int(z.get("ADJUST") or 0) > 0:
                    gruppe = "MIT_ADJUST"
                elif int(z.get("APPROVE") or 0) > 0:
                    gruppe = "NUR_APPROVE"
        except Exception:
            pass
        e = gruppen.setdefault(gruppe, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0})
        e["trades"] += 1
        if result == "WIN":
            e["wins"] += 1
        elif result == "LOSS":
            e["losses"] += 1
        e["pnl"] = round(e["pnl"] + float(pnl or 0), 2)
    for e in gruppen.values():
        entschieden = e["wins"] + e["losses"]
        e["winRate"] = round(e["wins"] / entschieden * 100, 1) if entschieden else None
    return gruppen


def _entry_quality_breakdown(days: int) -> dict:
    """Entry-Engine Phase D: WinRate/PnL gruppiert nach Entry-Quality-Tier.
    Liest den Tier aus notes.entryContext.entryQualityTier (seit 26.07.)."""
    import json as _json
    rows = pg_query(
        '''SELECT result, "profitLoss", notes
           FROM "Trade"
           WHERE status = 'CLOSED'
             AND "updatedAt" >= NOW() - INTERVAL '%s days' ''' % int(days)
    )
    tiers: dict[str, dict] = {}
    for result, pnl, notes in rows:
        tier = "UNBEKANNT"
        try:
            ctx = (_json.loads(notes) or {}).get("entryContext") or {}
            tier = ctx.get("entryQualityTier") or "UNBEKANNT"
        except Exception:
            pass
        e = tiers.setdefault(tier, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0})
        e["trades"] += 1
        if result == "WIN":
            e["wins"] += 1
        elif result == "LOSS":
            e["losses"] += 1
        e["pnl"] = round(e["pnl"] + float(pnl or 0), 2)
    for e in tiers.values():
        decided = e["wins"] + e["losses"]
        e["winRate"] = round(e["wins"] / decided * 100, 1) if decided else None
    return tiers


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


def _konsens_abschnitt() -> list[str]:
    """Ergebnis der Konsens-Auswertung (Stufe 4, Schritt 3 — 07.08.).

    Der Walk-Forward darüber prüft DREI einfache Strategien auf Schlusskursen.
    Gehandelt werden 16. Dieser Abschnitt zeigt, was der ECHTE Konsens in der
    Vergangenheit getragen hätte — und zwar als VORTEIL gegenüber der
    Marktbewegung im selben Zeitraum. Die rohe Rendite allein wäre wertlos: in
    einem steigenden Markt sieht ein Dauer-LONG glänzend aus, ohne etwas
    geleistet zu haben.

    Ohne diesen Abschnitt läge das Ergebnis nur in Redis und niemand sähe es.
    """
    daten = redis_get_json("analysis:konsens")
    if not daten or daten.get("status") != "done":
        return []
    ergebnisse = daten.get("results") or {}
    if not ergebnisse:
        return []

    zeilen = ["<b>🧭 Konsens-Auswertung (die 16 echten Strategien):</b>"]

    # Nach Vorteil auf dem Daytrading-Horizont sortiert, beide Richtungen
    # zusammengefasst — gewichtet mit der Zahl der Fälle, sonst zieht eine
    # Richtung mit 3 Fällen das Bild.
    bewertet: list[tuple[str, float, int, int]] = []
    for symbol, e in ergebnisse.items():
        tag = (e.get("horizonte") or {}).get("daytrading_24h", {}).get("alle")
        if not tag:
            continue
        summe = anzahl = 0.0
        for richtung in ("LONG", "SHORT"):
            d = tag.get(richtung) or {}
            summe += d.get("vorteilPct", 0.0) * d.get("n", 0)
            anzahl += d.get("n", 0)
        if anzahl:
            bewertet.append((symbol, summe / anzahl, e.get("bloeckeGesamt", 0),
                             e.get("balken", 0)))
    if not bewertet:
        return []
    bewertet.sort(key=lambda x: x[1], reverse=True)

    for symbol, vorteil, bloecke, balken in bewertet[:5]:
        vz = "+" if vorteil >= 0 else ""
        zeilen.append(f"• {symbol}: {vz}{vorteil:.3f}% Vorteil ({bloecke} Blöcke)")
    schwach = [s for s, v, _, _ in bewertet if v < 0]
    if schwach:
        zeilen.append(f"⚠️ Ohne Vorteil: {', '.join(schwach[:8])}"
                      + (" …" if len(schwach) > 8 else ""))

    # Die Datenlage gehört daneben, nicht in eine Fussnote: yfinance liefert
    # 15m nur 60 Tage, scalping fehlt deshalb über weite Teile des Fensters.
    luecken = sorted({
        name
        for e in ergebnisse.values()
        for name in (e.get("strategienMitLuecken") or {})
    })
    if luecken:
        zeilen.append(f"<i>Ohne volle Daten im Zeitraum: {', '.join(luecken)} "
                      f"(yfinance liefert 15m nur 60 Tage).</i>")
    zeilen.append(
        f"<i>Vorteil = Rendite nach dem Signal MINUS Marktbewegung im selben "
        f"Zeitraum. Fenster {daten.get('fensterTage')} Tage. Blöcke, nicht "
        f"Balken, sind die ehrliche Fallzahl — der Konsens hält über viele "
        f"Balken an.</i>"
    )
    zeilen.append("")
    return zeilen


def _muster_abschnitt() -> list[str]:
    """Ergebnis der Chartmuster-Rueckrechnung (10.08.).

    Die Muster erkennen, handeln aber bewusst nicht mit. Dieser Abschnitt
    beantwortet, ob sich das aendern sollte: er zeigt je Musterart den VORTEIL
    gegenueber der Marktbewegung im selben Zeitraum. Ein Muster mit negativem
    Vorteil haette Geld gekostet — unabhaengig davon, was Lehrbuecher sagen.

    Ohne diesen Abschnitt laege das Ergebnis nur in Redis und niemand saehe es.
    """
    daten = redis_get_json("analysis:muster")
    if not daten or daten.get("status") != "done":
        return []
    ergebnisse = daten.get("results") or {}
    if not ergebnisse:
        return []

    # Ueber alle Symbole zusammenfassen, mit der Fallzahl gewichtet — sonst
    # zieht ein Symbol mit drei Faellen das Bild.
    je_art: dict[str, dict] = {}
    for e in ergebnisse.values():
        for art, d in (e.get("jeMusterart") or {}).items():
            lang = (d.get("horizonte") or {}).get("swing_168h", {}).get("alle") or {}
            z = je_art.setdefault(art, {"n": 0, "summe": 0.0, "bloecke": 0})
            for richtung in ("LONG", "SHORT"):
                teil = lang.get(richtung) or {}
                n = int(teil.get("n", 0))
                z["n"] += n
                z["summe"] += float(teil.get("vorteilPct", 0.0)) * n
            z["bloecke"] += sum(int(v) for v in (d.get("bloecke") or {}).values())
    bewertet = [(a, z["summe"] / z["n"], z["n"], z["bloecke"])
                for a, z in je_art.items() if z["n"] > 0]
    if not bewertet:
        return []
    bewertet.sort(key=lambda x: x[1], reverse=True)

    zeilen = ["<b>📈 Chartmuster (gemessen, handeln NICHT mit):</b>"]
    for art, vorteil, n, bloecke in bewertet:
        vz = "+" if vorteil >= 0 else ""
        zeilen.append(f"• {art}: {vz}{vorteil:.3f}% Vorteil ({bloecke} Bloecke, {n} Balken)")
    zeilen.append("<i>Vorteil ueber den Swing-Horizont, MINUS Marktbewegung im selben "
                  "Zeitraum. Negativ heisst: dieses Muster haette Geld gekostet. "
                  "Bloecke, nicht Balken, sind die ehrliche Fallzahl.</i>")
    zeilen.append("")
    return zeilen


def _build_report(days: int, title: str, compare_previous: bool, show_walk_forward: bool = False) -> str:
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

    # Walk-Forward-Optimierung (Woche 2, 26.07.): zeigt ob die nächtlichen
    # Backtest-Ergebnisse auf ungesehenen Daten standhalten (Overfitting-Check)
    if show_walk_forward:
        wf = redis_get_json("analysis:walkforward")
        if wf and wf.get("robustSymbols") is not None:
            lines.append("<b>🔬 Walk-Forward (Overfitting-Check, Out-of-Sample):</b>")
            robust = wf.get("robustSymbols") or []
            overfit = wf.get("overfitWarningSymbols") or []
            if robust:
                lines.append(f"✅ Robust (auch auf ungesehenen Daten profitabel): {', '.join(robust)}")
            if overfit:
                lines.append(f"⚠️ Overfitting-Verdacht (nur In-Sample gut): {', '.join(overfit)}")
            if not robust and not overfit:
                lines.append("Keine Symbole mit klarem Ergebnis diese Woche.")
            lines.append("<i>Nur bei 'Robust' die Backtest-Erkenntnisse fürs Live-Trading vertrauen.</i>")
            lines.append("")

        lines.extend(_konsens_abschnitt())
        lines.extend(_muster_abschnitt())

    # Entry-Engine Phase D: Auswertung nach Entry-Quality-Tier
    tiers = _entry_quality_breakdown(days)
    rated = {k: v for k, v in tiers.items() if k != "UNBEKANNT"}
    if rated:
        lines.append("<b>🎯 Nach Entry-Quality (Engine):</b>")
        order = ["EXCELLENT", "GOOD", "MODERATE", "WEAK", "NO_SIGNAL"]
        for tier in sorted(rated.keys(), key=lambda x: order.index(x) if x in order else 99):
            e = rated[tier]
            wr = f"{e['winRate']}%" if e.get("winRate") is not None else "n/a"
            sign = "+" if e["pnl"] >= 0 else ""
            lines.append(f"• {tier}: {e['trades']} Trades, WR {wr}, {sign}{e['pnl']}")
        lines.append("<i>Wenn GOOD/EXCELLENT besser abschneiden → Engine wirkt, Schwelle anheben.</i>")
        lines.append("")

    # Was der AI Manager an den Positionen tat (10.08.) — beantwortet, ob sein
    # Eingreifen etwas gebracht hat. Bis dahin gab es dazu KEINE Zahl.
    ai = _ai_manager_breakdown(days)
    ai_bewertet = {k: v for k, v in ai.items() if k != "OHNE_ANGABE"}
    if ai_bewertet:
        lines.append("<b>🤖 Nach Eingriff des AI Managers:</b>")
        reihenfolge = ["NUR_APPROVE", "MIT_ADJUST", "MIT_SKIP"]
        for gruppe in sorted(ai_bewertet.keys(),
                             key=lambda x: reihenfolge.index(x) if x in reihenfolge else 99):
            e = ai_bewertet[gruppe]
            wr = f"{e['winRate']}%" if e.get("winRate") is not None else "n/a"
            vz = "+" if e["pnl"] >= 0 else ""
            lines.append(f"• {gruppe}: {e['trades']} Trades, WR {wr}, {vz}{e['pnl']}")
        ohne = ai.get("OHNE_ANGABE", {}).get("trades", 0)
        if ohne:
            lines.append(f"<i>{ohne} aeltere Trades ohne Angabe (vor dem 10.08.).</i>")
        lines.append("<i>MIT_SKIP = die AI hat mindestens eine Massnahme verhindert. "
                     "Schneidet diese Gruppe schlechter ab als NUR_APPROVE, greift sie zu oft ein.</i>")
        lines.append("")

    # Ausstiegsgrund (07.08.) — beantwortet, WARUM Trades enden
    gruende = _exit_reason_breakdown(days)
    benannt = {k: v for k, v in gruende.items() if k != "OHNE_ANGABE"}
    if benannt:
        lines.append("<b>🚪 Nach Ausstiegsgrund:</b>")
        # NIE_BESTAETIGT und KEIN_PNL ergaenzt (10.08.): Trades, deren Order nie
        # bestaetigt wurde bzw. deren P&L nie auftauchte. Sie zaehlen nicht als
        # echte Trades — bis heute landeten sie unbenannt als BREAKEVEN in der
        # Statistik und waren von einem echten Nulltrade nicht zu trennen.
        reihenfolge = ["ZIEL", "DAZWISCHEN", "STOP", "KEIN_SCHLUSSKURS",
                       "NIE_BESTAETIGT", "KEIN_PNL", "UNBEKANNT"]
        for grund in sorted(benannt.keys(),
                            key=lambda x: reihenfolge.index(x) if x in reihenfolge else 99):
            e = benannt[grund]
            wr = f"{e['winRate']}%" if e.get("winRate") is not None else "n/a"
            vz = "+" if e["pnl"] >= 0 else ""
            lines.append(f"• {grund}: {e['trades']} Trades, WR {wr}, {vz}{e['pnl']}")
        ohne = gruende.get("OHNE_ANGABE", {}).get("trades", 0)
        if ohne:
            lines.append(f"<i>{ohne} aeltere Trades ohne Angabe (vor dem 07.08.).</i>")
        lines.append("<i>DAZWISCHEN = weder Ziel noch Stop, also Zeit-Exit, Trailing oder Teilschliessung.</i>")
        if gruende.get("NIE_BESTAETIGT", {}).get("trades"):
            lines.append(f"<i>NIE_BESTAETIGT = die Order wurde abgeschickt, aber weder "
                         f"bestaetigt noch je als Position gesehen. Das sind vermutlich "
                         f"gar keine Trades — nicht mitrechnen.</i>")
        lines.append("")

    lines.append(f"🕐 {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC")
    return "\n".join(lines)


def run_weekly_report() -> None:
    logger.info("[report] Wochen-Report gestartet")
    _send(_build_report(7, "Wochen-Report — Analysis Engine", compare_previous=True, show_walk_forward=True))
    logger.info("[report] Wochen-Report gesendet")


def run_monthly_report() -> None:
    logger.info("[report] Monats-Report gestartet")
    _send(_build_report(30, "Monats-Report — Analysis Engine", compare_previous=True))
    logger.info("[report] Monats-Report gesendet")
