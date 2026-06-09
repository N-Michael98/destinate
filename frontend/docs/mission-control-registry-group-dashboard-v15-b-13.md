# V15.B.13 Mission Control Registry Group Dashboard

## Goal

Show Mission Control endpoint health grouped by system area.

## Added

- components/MissionControlRegistryGroupDashboard.tsx

## Connected

Unified Mission Control now displays endpoint groups:

- CORE
- AI
- PORTFOLIO
- EXECUTION
- BROKER
- MARKET
- EVOLUTION
- LEARNING

## Telegram Visibility

Mission Control now also shows a visible Telegram readiness card.

Telegram status:

- Payload preparation exists
- Real sending is disabled
- Bot token and chat id are not added yet
- Approval rules are not added yet

## Safety

No API changed.
No engine changed.
No trading logic changed.
No live execution changed.
No Telegram sending added.
Only UI grouping and visibility added.
