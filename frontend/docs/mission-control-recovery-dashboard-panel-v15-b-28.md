# V15.B.28 Mission Control Recovery Dashboard Panel

## Goal

Display Mission Control recovery analytics on the Unified Mission Control dashboard.

## Added

- components/MissionControlRecoveryPanel.tsx

## Connected

UnifiedMissionControlDashboard now fetches:

- GET /api/mission-control/recovery

and renders:

- tracked sources
- recovered sources
- active issue sources
- average recovery time
- recovery status list

## Safety

No trading logic changed.
No live execution changed.
No Telegram sending added.
No Health Scanner logic changed.
No Audit logic changed.
UI consumes existing read-only Recovery API only.
