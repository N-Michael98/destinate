# V15.B.24 Mission Control Event Timeline Panel

## Goal

Display persistent Mission Control event log entries on the Unified Mission Control dashboard.

## Added

- components/MissionControlEventTimelinePanel.tsx

## Connected

UnifiedMissionControlDashboard now fetches:

- GET /api/mission-control/events

and renders:

- latest persistent events
- warning count
- critical count
- event severity
- event type
- source
- timestamp

## Safety

No trading logic changed.
No live execution changed.
No Telegram sending added.
No Health Scanner logic changed.
No Audit logic changed.
UI consumes existing read-only Events API only.
