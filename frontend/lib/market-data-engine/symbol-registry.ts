export const SYMBOL_REGISTRY = {
  GOLD: {
    tradingview: "OANDA:XAUUSD",
    capital: "XAUUSD",
    icmarkets: "XAUUSD",
  },

  USOIL: {
    tradingview: "TVC:USOIL",
    capital: "OIL_CRUDE",
    icmarkets: "USOIL",
  },

  EURUSD: {
    tradingview: "FX:EURUSD",
    capital: "EURUSD",
    icmarkets: "EURUSD",
  },

  BTCUSD: {
    tradingview: "BINANCE:BTCUSDT",
    capital: "BTCUSD",
    icmarkets: "BTCUSD",
  },
} as const;