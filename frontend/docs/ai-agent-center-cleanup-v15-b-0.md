# V15.B.0 AI Agent Center Cleanup

## Goal

Stop the AI Agent Center from becoming overloaded again.

## What changed

Removed direct rendering of detailed center dashboards from AI Agent:

- EvolutionCenterPanel
- BrokerCenterPanel
- PortfolioBrainCenterPanel
- ExecutionCenterPanel

AI Agent is now only a command overview.

## New rule

Detailed dashboards must live in their correct sidebar pages:

- Evolution details -> Strategy Evolution
- Execution details -> Execution Center
- Broker details -> Broker Center
- Portfolio details -> Portfolio Brain
- Learning details -> AI Memory / Learning Reports
- Market details -> Market Data / News / Market Regime

## Safety

No API changed.
No engine changed.
No component deleted.
Only AI Agent visual structure cleaned.
