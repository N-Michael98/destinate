# V15.B.8 Unified Mission Control Dashboard

## Goal

Create a unified command center for the main dashboard view.

## Added

- components/UnifiedMissionControlDashboard.tsx

## Integrated

- app/page.tsx now routes activeView dashboard to UnifiedMissionControlDashboard

## Live Inputs

The dashboard safely fetches existing endpoints:

- dependency scanner
- portfolio brain
- consensus status
- execution tickets
- execution queue
- broker health monitor
- market data status
- market regime status
- opportunity scanner

## Safety

No API changed.
No engine changed.
No trading logic changed.
No live execution changed.
All failed API requests are handled safely in the UI.
