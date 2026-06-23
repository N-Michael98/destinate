from fastapi import APIRouter
from core.config import settings
from datetime import datetime

router = APIRouter()

@router.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {
        "ok": True,
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
    }
