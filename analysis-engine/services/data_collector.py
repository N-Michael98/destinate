"""
Data Collector — läuft alle 4h.

Liest abgeschlossene Trades aus PostgreSQL (Trade-Tabelle von destinate,
NUR lesend) und aggregiert Performance-Statistiken pro Markt und Strategie.

Ergebnis → Redis `analysis:trade_stats` (Grundlage für Forward-Test
Validator und AI Learning Manager in Phase 4).
"""

import json
from datetime import datetime, timezone

from loguru import logger

from services.storage import pg_query, redis_set_json

REDIS_KEY_TRADE_STATS = "analysis:trade_stats"
TTL = 26 * 60 * 60  # 26h — überlappt den 4h-Zyklus grosszügig

# Deckel für die "allTime"-Auswertung. Als Konstante, damit die Logzeile ihn
# BENENNEN kann (02.09.) — vorher stand die 500 nur in der SQL-Zeichenkette,
# und der Log meldete "500 Trades total". Von "es gibt genau 500" war das nicht
# zu unterscheiden, und am 02.09. griff der Deckel tatsächlich.
ALLTIME_LIMIT = 500


def _exit_grund(notes: str | None) -> str:
    """Ausstiegsgrund aus den Notizen holen (09.08.).

    Der Tracker leitet ihn seit dem 09.08. aus dem ECHTEN Schlusskurs ab
    (ZIEL / STOP / DAZWISCHEN). Vorher stand dort eine fest verdrahtete Null,
    und es war nicht feststellbar, WARUM ein Trade endete. Ohne diese
    Unterscheidung laesst sich nicht beantworten, warum die Stufe GOOD im
    Wochen-Report bei 66,7 % Treffern trotzdem Verlust macht.

    Alte Trades haben das Feld nicht — die zaehlen als "OHNE_ANGABE" und
    verfaelschen dadurch keine der anderen Gruppen.
    """
    if not notes:
        return "OHNE_ANGABE"
    try:
        return str((json.loads(notes) or {}).get("exitReason") or "OHNE_ANGABE")
    except (ValueError, TypeError):
        return "OHNE_ANGABE"


def _spread_je_symbol(rows: list[tuple]) -> dict:
    """Gemessener Spread je Markt aus den eigenen Trades (09.08.).

    WARUM: der Backtest rechnet heute nur mit fees=0.0002 (0.02 % je Seite).
    Der SPREAD fehlt — bei CFDs oft der groesste Kostenblock. Ohne ihn sieht
    jede Strategie besser aus als sie ist, und ROBUST_MIN_PF = 1.2 im
    Walk-Forward ist eine absolute Schwelle, auf die das direkt durchschlaegt.

    MESSEN, NICHT ANWENDEN: der Spread wird hier nur erhoben und mit der
    Stichprobengroesse gemeldet. Angewendet wird er erst, wenn sichtbar ist,
    dass genug Beobachtungen je Markt vorliegen — bei rund 3 Trades je Markt in
    30 Tagen waere ein Median heute reine Zufallszahl. Die Entscheidung
    braucht die Zahl, nicht eine Schaetzung davon.

    Rueckgabe je Symbol: Median-Spread absolut, in Prozent des Einstiegs, und
    die Zahl der Beobachtungen — damit sofort erkennbar ist, wie belastbar es ist.
    """
    roh: dict[str, list[tuple[float, float]]] = {}
    for market, _dir, _strat, _res, _pnl, _date, notes in rows:
        if not notes:
            continue
        try:
            ctx = (json.loads(notes) or {}).get("entryContext") or {}
        except (ValueError, TypeError):
            continue
        spread = ctx.get("spread")
        bid = ctx.get("bid")
        if not isinstance(spread, (int, float)) or spread <= 0:
            continue
        if not isinstance(bid, (int, float)) or bid <= 0:
            continue
        roh.setdefault(market or "UNKNOWN", []).append((float(spread), float(bid)))

    def median(werte: list[float]) -> float:
        w = sorted(werte)
        n = len(w)
        if n == 0:
            return 0.0
        return w[n // 2] if n % 2 else (w[n // 2 - 1] + w[n // 2]) / 2

    ergebnis = {}
    for markt, paare in roh.items():
        spreads = [s for s, _ in paare]
        prozente = [s / b * 100 for s, b in paare]
        ergebnis[markt] = {
            "medianSpread": round(median(spreads), 6),
            "medianSpreadPct": round(median(prozente), 4),
            "beobachtungen": len(paare),
        }
    return ergebnis


def _aggregate(rows: list[tuple]) -> dict:
    """rows: (market, direction, strategy, result, profitLoss, date, notes)"""
    by_market: dict[str, dict] = {}
    by_strategy: dict[str, dict] = {}
    by_exit: dict[str, dict] = {}
    total = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0}

    def bump(bucket: dict, key: str, result: str, pnl: float):
        e = bucket.setdefault(key, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0})
        e["trades"] += 1
        if result == "WIN":
            e["wins"] += 1
        elif result == "LOSS":
            e["losses"] += 1
        e["pnl"] = round(e["pnl"] + pnl, 2)

    for market, _direction, strategy, result, pnl, _date, notes in rows:
        pnl = float(pnl or 0)
        bump(by_market, market or "UNKNOWN", result, pnl)
        bump(by_strategy, (strategy or "Unclassified").upper(), result, pnl)
        bump(by_exit, _exit_grund(notes), result, pnl)
        total["trades"] += 1
        if result == "WIN":
            total["wins"] += 1
        elif result == "LOSS":
            total["losses"] += 1
        total["pnl"] = round(total["pnl"] + pnl, 2)

    def with_winrate(bucket: dict) -> dict:
        for e in bucket.values():
            decided = e["wins"] + e["losses"]
            e["winRate"] = round(e["wins"] / decided * 100, 1) if decided else None
        return bucket

    decided = total["wins"] + total["losses"]
    total["winRate"] = round(total["wins"] / decided * 100, 1) if decided else None

    return {
        "total": total,
        "byMarket": with_winrate(by_market),
        "byStrategy": with_winrate(by_strategy),
        "byExitReason": with_winrate(by_exit),
    }


def run_data_collector() -> None:
    logger.info("[data-collector] Zyklus gestartet")

    # Letzte N geschlossene Trades (read-only!)
    rows = pg_query(
        f'''SELECT market, direction, strategy, result, "profitLoss", date, notes
           FROM "Trade"
           WHERE status = 'CLOSED'
           ORDER BY date DESC
           LIMIT {ALLTIME_LIMIT}'''
    )

    # Wie viele sind es WIRKLICH? (02.09.)
    #
    # `len(rows)` kann den Deckel nicht von der Wahrheit unterscheiden. Am
    # 02.09. meldete das Log "500 Trades total" — exakt der Deckel, also
    # greift er, und der Schlüssel heisst trotzdem `allTime`. Ein COUNT(*) auf
    # denselben Filter kostet praktisch nichts und sagt es genau.
    #
    # Schlägt die Zählung fehl, wird NICHTS behauptet: `gesamt` bleibt None,
    # und Logzeile wie Kennzahl sagen dann "unbekannt" statt einer Zahl.
    gesamt_rows = pg_query(
        '''SELECT COUNT(*) FROM "Trade" WHERE status = 'CLOSED' '''
    )
    gesamt = int(gesamt_rows[0][0]) if gesamt_rows and gesamt_rows[0] else None
    gedeckelt = gesamt is not None and len(rows) < gesamt

    # Letzte 30 Tage separat (aktuellere Sicht für Forward-Testing)
    rows_30d = pg_query(
        '''SELECT market, direction, strategy, result, "profitLoss", date, notes
           FROM "Trade"
           WHERE status = 'CLOSED' AND date >= NOW() - INTERVAL '30 days'
           ORDER BY date DESC'''
    )

    spreads = _spread_je_symbol(rows)
    stats = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "allTime": _aggregate(rows),
        "last30d": _aggregate(rows_30d),
        # `allTime` ist der GEDECKELTE Ausschnitt — der Name luegt, seit der
        # Deckel greift. Umbenennen wuerde die Leser brechen, also steht die
        # Wahrheit jetzt DANEBEN: wie viele es wirklich sind und ob gedeckelt
        # wurde. (Belegt harmlos: ai_learning, backtest_engine und
        # recommendations lesen ausschliesslich `last30d`, und das hat KEINEN
        # Deckel. `allTime` geht nur an /api/v1/trade-stats, das im Frontend
        # keinen Leser hat — nachgeprueft, nicht angenommen.)
        "sampleSize": {
            "allTime": len(rows),
            "last30d": len(rows_30d),
            "geschlossenGesamt": gesamt,
            "allTimeGedeckelt": gedeckelt,
            "allTimeDeckel": ALLTIME_LIMIT,
        },
        # Nur erhoben, noch NICHT als Kosten angewendet — siehe _spread_je_symbol
        "spreadBySymbol": spreads,
    }

    ok = redis_set_json(REDIS_KEY_TRADE_STATS, stats, TTL)
    genug = sum(1 for e in spreads.values() if e["beobachtungen"] >= 10)
    logger.info(
        f"[data-collector] fertig — {len(rows)} von "
        f"{gesamt if gesamt is not None else 'unbekannt vielen'} geschlossenen "
        f"Trades ausgewertet"
        f"{f' (Deckel {ALLTIME_LIMIT} GREIFT)' if gedeckelt else ''}, "
        f"{len(rows_30d)} in 30d, Spread gemessen fuer {len(spreads)} Maerkte "
        f"(davon {genug} mit >= 10 Beobachtungen), Redis={'ok' if ok else 'FEHLER'}"
    )
