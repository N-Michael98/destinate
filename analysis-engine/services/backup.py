"""
Backup-Service (2026-07-26) — nächtlich 01:00 UTC.

Sichert die UNERSETZLICHEN Daten (Trade-Historie, Journal, Backtests, Lern-
Gedächtnis) als gzip-JSON und schickt sie als Telegram-Dokument an den Admin.

SICHERHEIT:
- Nur SELECT (read-only) — schreibt NIE in die DB, kann das Trading nicht stören.
- Exportiert bewusst KEINE Tabellen mit Secrets (CapitalCredentials, AIConfig,
  SystemSettings, User) — die dürfen nie per Telegram raus und sind ohnehin
  über Railway-Env-Vars wiederherstellbar.
- Grössen-Schutz: > 45 MB → warnt statt zu senden (Telegram-Limit 50 MB).
"""

import gzip
import io
import json
from datetime import datetime, timezone

import httpx
from loguru import logger

from core.config import settings

# Nur unersetzliche, secret-freie Tabellen
BACKUP_TABLES = ["Trade", "PaperOrder", "BacktestRun", "LearningSnapshot"]
MAX_TELEGRAM_BYTES = 45 * 1024 * 1024  # 45 MB Sicherheitsmarge (Limit 50 MB)


def _dump_table(table: str) -> list[dict]:
    """SELECT * einer Tabelle als Liste von Dicts (mit Spaltennamen). [] bei Fehler."""
    if not settings.DATABASE_URL:
        return []
    conn = None
    try:
        import psycopg2
        conn = psycopg2.connect(settings.DATABASE_URL, connect_timeout=15)
        with conn.cursor() as cur:
            cur.execute(f'SELECT * FROM "{table}"')  # Tabellennamen aus fixer Liste — kein Injection-Risiko
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            return [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        logger.warning(f"[backup] Tabelle {table} fehlgeschlagen: {e}")
        return []
    finally:
        if conn:
            conn.close()


def _send_document(filename: str, data: bytes, caption: str) -> bool:
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID):
        logger.warning("[backup] Telegram nicht konfiguriert")
        return False
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendDocument",
            data={"chat_id": settings.TELEGRAM_CHAT_ID, "caption": caption},
            files={"document": (filename, data, "application/gzip")},
            timeout=120,
        )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f"[backup] Telegram sendDocument fehlgeschlagen: {e}")
        return False


def _send_message(text: str) -> None:
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID):
        return
    try:
        httpx.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
    except Exception:
        pass


def run_backup() -> None:
    logger.info("[backup] Zyklus gestartet")
    try:
        payload = {
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "tables": {},
        }
        counts = {}
        for t in BACKUP_TABLES:
            rows = _dump_table(t)
            payload["tables"][t] = rows
            counts[t] = len(rows)

        total_rows = sum(counts.values())
        if total_rows == 0:
            logger.warning("[backup] 0 Zeilen — DB nicht erreichbar? Kein Versand.")
            _send_message("⚠️ <b>Backup übersprungen</b> — 0 Zeilen gelesen (DB nicht erreichbar?)")
            return

        # JSON → gzip (default=str fängt Datetime/Decimal ab)
        raw = json.dumps(payload, default=str, ensure_ascii=False).encode("utf-8")
        buf = io.BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb") as gz:
            gz.write(raw)
        blob = buf.getvalue()

        size_mb = len(blob) / (1024 * 1024)
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = f"destinate-backup-{stamp}.json.gz"
        caption = (
            f"💾 Backup {stamp}\n"
            + " | ".join(f"{t}:{c}" for t, c in counts.items())
            + f"\nGrösse: {size_mb:.2f} MB"
        )

        if len(blob) > MAX_TELEGRAM_BYTES:
            logger.warning(f"[backup] {size_mb:.1f} MB > Limit — nicht gesendet")
            _send_message(f"⚠️ <b>Backup zu gross für Telegram</b> ({size_mb:.1f} MB)\n"
                          f"{caption}\n<i>Zeit für Cloud-Speicher (R2).</i>")
            return

        ok = _send_document(filename, blob, caption)
        logger.info(f"[backup] {total_rows} Zeilen, {size_mb:.2f} MB — Telegram={'ok' if ok else 'FEHLER'}")
        if not ok:
            _send_message(f"⚠️ <b>Backup-Versand fehlgeschlagen</b>\n{caption}")
    except Exception as e:
        logger.error(f"[backup] Fehler (non-fatal): {e}")
        _send_message(f"⚠️ <b>Backup-Fehler</b>: {str(e)[:200]}")
