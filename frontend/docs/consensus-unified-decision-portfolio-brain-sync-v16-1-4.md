# V16.1.4 Consensus Unified Decision to Portfolio Brain Sync

## Goal

Connect Multi-Style Consensus Unified Decision Sync into Portfolio Brain Evolution Sync.

## Changed

- lib/portfolio-brain-evolution-sync/portfolio-brain-evolution-sync-engine.ts
- lib/portfolio-brain-evolution-sync/portfolio-brain-evolution-sync-types.ts

## New Signal

consensusPortfolioSignal

## Logic

- CONSENSUS_ELITE -> MAXIMUM priority, +10 risk adjustment
- CONSENSUS_APPROVED -> HIGH priority, +5 risk adjustment
- CONSENSUS_STRICT -> REDUCED priority, -10 risk adjustment
- CONSENSUS_BLOCKED -> ZERO priority, -25 risk adjustment

## Safety

No live trading.
No broker execution.
No order routing.
Portfolio Brain receives simulation allocation/risk bias only.
