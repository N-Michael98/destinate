# V15.B.21 Mission Control Event Log API

## Goal

Expose the persistent Mission Control event log through a read-only API.

## Added

- app/api/mission-control/events/route.ts

## Endpoint

GET /api/mission-control/events

## Returns

- all events
- latest events
- critical events
- warning events
- stats
- timestamp

## Safety

No POST added.
No automatic event writing added.
No UI changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
Read-only API only.
