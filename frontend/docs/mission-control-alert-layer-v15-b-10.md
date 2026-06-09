# V15.B.10 Mission Control Alert Layer

## Goal

Add a Mission Control alert layer based on existing endpoint states.

## Added

- components/MissionControlAlertLayer.tsx

## Behavior

- ERROR endpoints create CRITICAL alerts
- WARNING endpoints create REVIEW alerts
- If no warning/error exists, a HEALTHY alert is shown

## Telegram Future Compatibility

The alert objects are structured so a future Telegram bridge can reuse:

- level
- title
- message

## Safety

No API changed.
No engine changed.
No trading logic changed.
No live execution changed.
Only UI alert visualization added.
