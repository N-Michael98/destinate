export function buildRiskReasoning(
  drawdownRisk: string,
  exposureRisk: string,
  positionRisk: string,
  volatilityRisk: string
): string {

  return `
Drawdown Risk: ${drawdownRisk}
Exposure Risk: ${exposureRisk}
Position Risk: ${positionRisk}
Volatility Risk: ${volatilityRisk}
`.trim();
}