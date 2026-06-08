# V15.A.5 Dependency Scanner

## Goal

Create a permanent dependency and health overview for the AI Trading System.

## Purpose

The Dependency Scanner helps identify:

- active modules
- center modules
- legacy review modules
- dependency links
- future alert candidates
- Telegram alert readiness

## Important

This version does not delete engines.
This version does not remove APIs.
This version does not change trading logic.

## Future Telegram Alert Plan

Later, when Telegram integration is added, this scanner can trigger alerts when:

- an API fails
- an engine returns unhealthy status
- a dependency is missing
- a legacy module is still used unexpectedly
- broker connection becomes limited
- execution sync becomes degraded
- GPT / Claude / Consensus connection fails

Example future alert:

AI Trading System Alert:
Module: Species Broker Execution Sync
Health: CRITICAL
Layer: BROKER
Action: Check dependency scanner.

## Current Status

Telegram sending is not enabled yet.
Telegram readiness flags are prepared.
