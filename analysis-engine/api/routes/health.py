"""Health-Check — Railway nutzt das für Deploy-Verification."""

from fastapi import APIRouter
from core.config import settings

router = APIRouter()


@router.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "config": {
            "database": bool(settings.DATABASE_URL),
            "redis": bool(settings.REDIS_URL),
            "python_backend": bool(settings.PYTHON_BACKEND_URL),
            "anthropic": bool(settings.ANTHROPIC_API_KEY),
            "telegram": bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID),
        },
    }
