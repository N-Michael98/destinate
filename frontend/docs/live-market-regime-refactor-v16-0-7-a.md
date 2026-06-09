# V16.0.7.A Live Market Regime Refactor

## Goal

Connect Market Regime Classification to the dynamic Market Data Engine instead of hardcoded static prices.

## Changed

- app/api/market-regime/classify/route.ts

## Before

The route used hardcoded prices:

- XAUUSD 3372
- USOIL 78
- EURUSD 1.08
- BTCUSD 68300

## After

The route now uses:

- marketDataManager.refreshPrices()
- bid/ask midpoint price
- live mock spread
- regimeManager.getRegime(symbol, midpoint, spread)

## Result

Refresh now recalculates regimes from updated dynamic mock-live market data.

## Safety

No broker connection added.
No live trading added.
No execution changed.
No strategy logic changed.
This remains MOCK_LIVE simulation until real market feeds are connected.
