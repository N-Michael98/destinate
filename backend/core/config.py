from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "Destinate Backend"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    # CORS — Next.js Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Telegram
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None

    # Capital.com
    CAPITAL_API_KEY: Optional[str] = None
    CAPITAL_IDENTIFIER: Optional[str] = None
    CAPITAL_PASSWORD: Optional[str] = None

    # IC Markets cTrader
    ICMARKETS_CLIENT_ID: Optional[str] = None
    ICMARKETS_CLIENT_SECRET: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
