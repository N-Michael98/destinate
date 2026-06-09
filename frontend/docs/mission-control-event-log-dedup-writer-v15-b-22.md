# V15.B.22 Mission Control Event Log Dedup Writer

## Goal

Prepare Mission Control Event Log for safe writer integration.

## Added

- MissionControlEventLog.addDeduped()

## Why

Mission Control refreshes every few seconds.
Without deduplication, WARNING/ERROR events could spam the event log.

## Behavior

addDeduped() checks:

- same type
- same source
- same severity
- inside dedupe time window

Default dedupe window:

- 5 minutes

## Safety

No Health Scanner integration yet.
No Audit integration yet.
No UI changed.
No API changed.
No trading logic changed.
No live execution changed.
