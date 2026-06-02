import type { MarketAdaptation } from "./evolution-types";

export function getMockMarketAdaptations(): MarketAdaptation[] {
  return [
    {
      market: "NAS100",
      bestStrategy: "Momentum Breakout",
      score: 82,
    },
    {
      market: "XAUUSD",
      bestStrategy: "Risk-Off Trend",
      score: 86,
    },
    {
      market: "USOIL",
      bestStrategy: "Inventory Reaction",
      score: 78,
    },
  ];
}