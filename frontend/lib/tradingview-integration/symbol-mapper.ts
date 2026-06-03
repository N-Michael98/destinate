export function mapTradingSymbol(symbol: string): string {
  const symbols: Record<string, string> = {
    GOLD: "OANDA:XAUUSD",
    SILVER: "OANDA:XAGUSD",
    EURUSD: "FX:EURUSD",
    GBPUSD: "FX:GBPUSD",
    USOIL: "TVC:USOIL",
    BTCUSD: "BINANCE:BTCUSDT",
  };

  return symbols[symbol] ?? symbol;
}