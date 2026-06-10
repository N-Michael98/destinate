# V16.1.6 Broker Selection to Broker Routing Sync

## Goal

Connect Portfolio Brain Broker Selection Sync to Broker Routing.

## Added

- lib/broker-selection-routing-sync
- app/api/broker-selection-routing-sync/route.ts

## Logic

- DUAL_BROKER_PRIORITY -> routed dual-broker priority
- DUAL_BROKER_CHECK -> routed dual-broker check
- SINGLE_BROKER_CHECK -> waiting if strict approval required
- NO_BROKER_ROUTE -> blocked

## Safety

No live trading.
No broker execution.
No order routing.
Simulation only.
