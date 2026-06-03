export function buildReasoning(
  trend: string,
  volatility: string,
  risk: string
) {
  return `
Trend: ${trend}
Volatility: ${volatility}
Risk: ${risk}
`.trim();
}