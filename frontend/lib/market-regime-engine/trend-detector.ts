export function detectTrend(price: number): string {
  if (price > 3000) return "TRENDING_BULL";

  if (price < 1000) return "TRENDING_BEAR";

  return "RANGING";
}