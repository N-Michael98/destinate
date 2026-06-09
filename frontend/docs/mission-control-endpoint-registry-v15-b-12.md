# V15.B.12 Mission Control Endpoint Registry

## Goal

Create one central endpoint registry for Mission Control.

## Added

- lib/mission-control-endpoint-registry.ts

## Connected

Unified Mission Control now reads endpoints from:

- missionControlEndpointRegistry

## Why this matters

Future systems can use the same source:

- health charts
- alert layer
- Telegram alert bridge
- dependency validation
- endpoint grouping
- critical system monitoring

## Endpoint metadata

Each endpoint includes:

- key
- label
- endpoint path
- group
- critical flag
- description

## Safety

No API changed.
No engine changed.
No trading logic changed.
No live execution changed.
Only endpoint source organization changed.
