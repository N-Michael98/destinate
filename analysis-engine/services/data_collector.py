"""
Data Collector — läuft alle 4h.

Liest abgeschlossene Trades aus PostgreSQL (Trade-Tabelle von destinate,
NUR lesend) und aggregiert Performance-Statistiken pro Markt und Strategie.

Ergebnis → Redis `analysis:trade_stats` (Grundlage für Forward-Test
Validator und AI Learning Manager in Phase 4).
"""

from datetime import datetime, timezone

from loguru import logger

from services.storage import pg_query, redis_set_json

REDIS_KEY_TRADE_STATS = "analysis:trade_stats"
TTL = 26 * 60 * 60  # 26h — überlappt den 4h-Zyklus grosszügig


def _aggregate(rows: list[tuple]) -> dict:
    """rows: (market, direction, strategy, result, profitLoss, date)"""
    by_market: dict[str, dict] = {}
    by_strategy: dict[str, dict] = {}
    total = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0}

    def bump(bucket: dict, key: str, result: str, pnl: float):
        e = bucket.setdefault(key, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0})
        e["trades"] += 1
        if result == "WIN":
            e["wins"] += 1
        elif result == "LOSS":
            e["losses"] += 1
        e["pnl"] = round(e["pnl"] + pnl, 2)

    for market, _direction, strategy, result, pnl, _date in rows:
        pnl = float(pnl or 0)
        bump(by_market, market or "UNKNOWN", result, pnl)
        bump(by_strategy, (strategy or "Unclassified").upper(), result, pnl)
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
    }


def run_data_collector() -> None:
    logger.info("[data-collector] Zyklus gestartet")

    # Letzte 500 geschlossene Trades (read-only!)
    rows = pg_query(
        '''SELECT market, direction, strategy, result, "profitLoss", date
           FROM "Trade"
           WHERE status = 'CLOSED'
           ORDER BY date DESC
           LIMIT 500'''
    )

    # Letzte 30 Tage separat (aktuellere Sicht für Forward-Testing)
    rows_30d = pg_query(
        '''SELECT market, direction, strategy, result, "profitLoss", date
           FROM "Trade"
           WHERE status = 'CLOSED' AND date >= NOW() - INTERVAL '30 days'
           ORDER BY date DESC'''
    )

    stats = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "allTime": _aggregate(rows),
        "last30d": _aggregate(rows_30d),
        "sampleSize": {"allTime": len(rows), "last30d": len(rows_30d)},
    }

    ok = redis_set_json(REDIS_KEY_TRADE_STATS, stats, TTL)
    logger.info(
        f"[data-collector] fertig — {len(rows)} Trades total, "
        f"{len(rows_30d)} in 30d, Redis={'ok' if ok else 'FEHLER'}"
    )
