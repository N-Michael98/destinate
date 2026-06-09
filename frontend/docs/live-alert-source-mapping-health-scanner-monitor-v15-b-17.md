# V15.B.17 Live Alert Source Mapping + Health Scanner Monitor Panel

## Goal

Make the Health Scanner visible on the main Mission Control dashboard and prepare live alert source mapping.

## Added

- components/HealthScannerMonitorPanel.tsx
- lib/mission-control/live-alert-source-mapping.ts

## Connected

Unified Mission Control now shows:

- scanned endpoint
- group
- status
- response time
- critical flag
- summary

## Alert mapping

Health scanner results can now be mapped into Telegram-ready alert payloads through:

- mapHealthScannerToAlertSources()

## Safety

No API changed.
No engine changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
Only scanner visibility and alert source mapping were added.
