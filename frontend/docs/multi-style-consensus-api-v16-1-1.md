# V16.1.1 Multi-Style Consensus API

## Goal

Expose Multi-Style Consensus Engine Core through an API endpoint.

## Added

- app/api/multi-style-consensus/route.ts

## Endpoint

- /api/multi-style-consensus

## Connected Source

- lib/multi-style-consensus

## Output

- goCount
- consensusLevel
- consensusScore
- consensusStatus
- approvedStyles
- strictApprovalStyles
- recommendedPositionMultiplier
- recommendedFinalPositionSize

## Safety

No live trading.
No broker execution.
No order routing.
Simulation only.
