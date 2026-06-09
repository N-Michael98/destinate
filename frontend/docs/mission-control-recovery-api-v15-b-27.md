# V15.B.27 Mission Control Recovery API

## Goal

Expose Mission Control recovery analytics through a read-only API.

## Added

- app/api/mission-control/recovery/route.ts

## Endpoint

GET /api/mission-control/recovery

## Returns

- recovery report
- tracked sources
- recovered sources
- active issue sources
- average recovery time
- recovery items
- timestamp

## Safety

Read-only API.
No UI changed.
No dashboard changed.
No Health Scanner changed.
No Audit changed.
No Event Writer changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
