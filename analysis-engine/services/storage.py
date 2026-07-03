"""
Gemeinsame Storage-Helfer: Redis + PostgreSQL Verbindungen.
Alle Funktionen sind Fallback-sicher — bei Fehler wird geloggt, nie gecrasht.
"""

import json
from typing import Any, Optional

from loguru import logger

from core.config import settings


def get_redis():
    """Redis-Client oder None (non-fatal)."""
    if not settings.REDIS_URL:
        return None
    try:
        import redis
        return redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=5)
    except Exception as e:
        logger.warning(f"Redis nicht erreichbar: {e}")
        return None


def redis_set_json(key: str, value: Any, ttl_seconds: int) -> bool:
    r = get_redis()
    if r is None:
        return False
    try:
        r.set(key, json.dumps(value, default=str), ex=ttl_seconds)
        return True
    except Exception as e:
        logger.warning(f"Redis set {key} fehlgeschlagen: {e}")
        return False


def redis_get_json(key: str) -> Optional[Any]:
    r = get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning(f"Redis get {key} fehlgeschlagen: {e}")
        return None


def pg_query(sql: str, params: tuple = ()) -> list[tuple]:
    """Read-only Query gegen PostgreSQL. Gibt [] bei Fehler zurück."""
    if not settings.DATABASE_URL:
        logger.warning("DATABASE_URL nicht gesetzt")
        return []
    conn = None
    try:
        import psycopg2
        conn = psycopg2.connect(settings.DATABASE_URL, connect_timeout=10)
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    except Exception as e:
        logger.warning(f"PG Query fehlgeschlagen: {e}")
        return []
    finally:
        if conn:
            conn.close()
