# V16.2.1 Paper Position to Account Sync

## Goal

Convert open V16 paper positions into account-level risk, margin and exposure metrics.

## Input

- paperTradingManager.getPositions()
- paperTradingManager.getAccount()

## Output

- balance
- equity
- unrealized PnL
- total exposure
- open risk
- used margin
- free margin
- margin usage percent
- account risk mode

## Safety

No live trading.
No broker execution.
No real orders.
Paper/simulation only.
