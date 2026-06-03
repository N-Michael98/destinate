export function detectRiskRegime(symbol: string): string {
  if (symbol === "BTCUSD") {
    return "RISK_ON";
  }

  if (symbol === "XAUUSD") {
    return "RISK_OFF";
  }

  return "NEUTRAL";
}