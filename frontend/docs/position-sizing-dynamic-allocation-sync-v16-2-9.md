# V16.2.9 Position Sizing Evolution to Dynamic Position Allocation Sync

## Goal

Connect V16.2.8 Position Sizing Evolution Sync to the existing V12.2.0 Dynamic Position Allocation engine.

## Changed

- Dynamic Position Allocation now imports Position Sizing Evolution Sync.
- Requested lots are multiplied by `allocationMultiplier`.
- Existing max-position limits remain active.
- Existing Smart Broker route split remains unchanged.

## Safety

No live trading.
No broker execution.
No real orders.
Simulation allocation only.
