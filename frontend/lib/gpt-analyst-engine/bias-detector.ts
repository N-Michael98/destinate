export function detectBias(
  trend: string,
  risk: string
) {
  if (
    trend === "TRENDING_BULL" &&
    risk !== "RISK_OFF"
  ) {
    return "BULLISH";
  }

  if (
    trend === "TRENDING_BEAR"
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}