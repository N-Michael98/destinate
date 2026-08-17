"""
Zentrale Konfiguration — alle Werte aus Railway Environment Variables.
NIEMALS Credentials hardcoden.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Destinate Analysis Engine"
    VERSION: str = "0.1.0"

    # PostgreSQL (Railway: DATABASE_URL vom Postgres-Service)
    DATABASE_URL: str = ""

    # Redis (Railway: REDIS_URL vom Redis-Service)
    REDIS_URL: str = ""

    # divine-warmth Backend (ATR, Indikatoren, Kurse)
    PYTHON_BACKEND_URL: str = ""
    # Key um sich beim Backend zu authentifizieren (27.07., Audit-Fund #1).
    # Muss mit dessen BACKEND_API_KEY übereinstimmen. Leer = kein Header (fail-safe).
    BACKEND_API_KEY: str = ""

    # Claude AI Manager
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-haiku-4-5-20251001"

    # Telegram Reports
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # API-Schutz: wenn gesetzt, brauchen alle /api/v1/* Requests den Header
    # X-Analysis-Key mit diesem Wert. Leer = offen (Fallback, nichts bricht).
    ANALYSIS_API_KEY: str = ""

    # Fensterlänge der Konsens-Auswertung in Tagen (Stufe 4, Schritt 3).
    # Über die Umgebung einstellbar, weil die Rechnung in divine-warmth
    # anfällt — dem Dienst, der alle 5 Minuten auch den Live-Scan bedient.
    # 0 = Standard (90) verwenden.
    KONSENS_FENSTER_TAGE: int = 0

    # Fensterlänge der Chartmuster-Rückrechnung in Tagen (17.08.).
    # 0 = Standard (365) verwenden.
    MUSTER_FENSTER_TAGE: int = 0

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
