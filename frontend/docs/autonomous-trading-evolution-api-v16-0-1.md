# V16.0.1 Autonomous Trading Evolution API

## Goal

Expose the V16.0.0 Autonomous Trading Evolution Engine Core through a read-only API endpoint.

## Added

- app/api/autonomous-trading-evolution/route.ts

## Endpoint

GET /api/autonomous-trading-evolution

## Returns

- ok
- report
- timestamp

## Report Includes

- top strategy
- best mutation
- best hybrid
- champion species
- autonomous evolution score
- cycle decision
- decision list
- connected engine versions

## Safety

Read-only API.
No UI changed.
No broker logic changed.
No trade execution changed.
No live trading added.
No existing engine changed.
