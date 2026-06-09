# V15.B.15 Live Mission Control Health Integration

## Goal

Connect Unified Mission Control Dashboard directly to the central Mission Control health API.

## Connected

UnifiedMissionControlDashboard now fetches:

- /api/mission-control/health

This means the dashboard now receives endpoint health from:

- health scanner
- endpoint registry
- central health API

## Dashboard now uses

- report.endpoints
- report.checkedAt
- responseTimeMs
- group
- critical

## Safety

No engine changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
Only dashboard data source changed from direct client-side scanning to central health API.
