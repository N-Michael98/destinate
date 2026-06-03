import { detectTrend } from "./trend-detector";
import { detectVolatility } from "./volatility-detector";
import { detectRiskRegime } from "./risk-regime-detector";

export function classifyRegime(
  symbol: string,
  price: number,
  spread: number
) {
  const trend = detectTrend(price);
  const volatility = detectVolatility(spread);
  const risk = detectRiskRegime(symbol);

  return {
    trend,
    volatility,
    risk,
  };
}