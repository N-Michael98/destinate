// 26.08. entfernt: `./symbol-registry` und `./feed-router`.
//
// SYMBOL_REGISTRY hielt 4 von 30 Symbolen, unter dem Schlüssel `GOLD` statt
// `XAUUSD` wie im Rest des Programms, und wurde von KEINEM Prüfer erfasst —
// `watchlist-sync` sichert sechs andere Stellen. Gelesen hat es nur
// `/api/market-data/symbols`, und diese Route rief niemand. Die richtige
// Zuordnung Symbol → Broker-Name steht in `EPIC_MAP` und `INSTRUMENT_META`
// und ist dort geprüft; eine fünfte Kopie hätte das Risiko erhöht, nicht
// gesenkt (siehe CLAUDE.md: "Alle zusammen ändern oder gar nicht").
//
// feedRouter gab eine feste Reihenfolge "CAPITAL_COM, IC_MARKETS,
// TRADINGVIEW" zurück und hatte NULL Verwendungen. Die echte Reihenfolge
// steht in `fetchMarkets()`: Capital zuerst, Python/yfinance als Rückfall.
export * from "./market-types";
export * from "./price-cache";
export * from "./market-health";
export * from "./market-data-manager";
