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

    # Claude AI Manager
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-haiku-4-5-20251001"

    # Telegram Reports
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
