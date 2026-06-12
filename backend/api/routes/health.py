from fastapi import APIRouter
from core.config import settings
from datetime import datetime

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "ok": True,
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
    }
