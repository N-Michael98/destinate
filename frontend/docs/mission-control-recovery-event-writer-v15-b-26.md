# V15.B.26 Mission Control Recovery Event Writer

## Goal

Write automatic recovery events when a Mission Control endpoint returns to READY after a previous warning or critical health event.

## Changed

- app/api/mission-control/health/route.ts

## Behavior

If an endpoint is READY:

- checks previous events for the same source
- finds latest WARNING/CRITICAL health issue
- checks whether a newer recovery event exists
- writes HEALTH_RECOVERY with severity INFO when recovered

## Safety

Uses MissionControlEventLog.addDeduped().
No UI changed.
No API shape changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
