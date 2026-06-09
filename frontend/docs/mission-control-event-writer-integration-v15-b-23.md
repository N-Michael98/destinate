# V15.B.23 Mission Control Event Writer Integration

## Goal

Connect Mission Control runtime and audit reports to the persistent event log.

## Changed

- app/api/mission-control/health/route.ts
- app/api/mission-control/audit/route.ts

## Behavior

Health API writes deduped events for:

- ERROR -> CRITICAL
- WARNING -> WARNING

Audit API writes deduped events for:

- FAIL -> CRITICAL
- REVIEW -> WARNING

## Safety

Logging happens only through addDeduped().
Default dedupe window is 5 minutes.
READY/PASS states are not logged.
No UI changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
