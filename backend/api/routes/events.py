"""
Event Bus API Routes
GET  /api/v1/events/stats    → Statistiken
GET  /api/v1/events/history  → Event History
POST /api/v1/events/killswitch/reset → Killswitch zurücksetzen
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.event_bus import bus, EventType

router = APIRouter(prefix="/events", tags=["Event Bus"])

class KillswitchReset(BaseModel):
    password: str

@router.get("/stats")
def event_stats():
    return bus.get_stats()

@router.get("/history")
def event_history(event_type: str | None = None, limit: int = 50):
    return {"events": bus.get_history(event_type, limit)}

@router.get("/killswitch")
def killswitch_status():
    return {"active": bus.killswitch_active}

@router.post("/killswitch/reset")
def reset_killswitch(body: KillswitchReset):
    ok = bus.reset_killswitch(body.password)
    if not ok:
        raise HTTPException(status_code=403, detail="Falsches Passwort")
    return {"ok": True, "message": "Killswitch deaktiviert"}

@router.post("/test")
async def test_event():
    """Test-Endpoint: sendet einen Test-Event."""
    await bus.publish(EventType.INFO, {"message": "Test Event vom API"}, source="api")
    return {"ok": True, "message": "Test Event gesendet"}
