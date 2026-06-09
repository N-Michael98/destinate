# V15.B.25 Mission Control Recovery Tracker

## Goal

Prepare Mission Control to analyze issue and recovery events from the persistent event log.

## Added

- lib/mission-control/recovery-tracker.ts

## Behavior

The recovery tracker reads MissionControlEventLog and groups events by source.

It detects issue events from:

- WARNING
- CRITICAL
- ERROR
- FAIL
- REVIEW

It detects recovery events from INFO events containing:

- RECOVERY
- READY
- PASS

## Current Limitation

The system currently logs warning and critical events.
READY/PASS recovery events are not written yet.

That means this version prepares recovery analytics but does not yet create recovery events automatically.

## Safety

No UI changed.
No API changed.
No dashboard changed.
No Health Scanner changed.
No Audit changed.
No trading logic changed.
No live execution changed.
