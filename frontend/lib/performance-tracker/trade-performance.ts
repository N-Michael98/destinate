import type { TradeResult } from "./performance-types";

export function getMockTradeResults(): TradeResult[] {
  return [
    {
      id: "DEMO-001",
      market: "NAS100",
      strategy: "Momentum Breakout",
      resultR: 4.2,
      outcome: "WIN",
    },

    {
      id: "DEMO-002",
      market: "XAUUSD",
      strategy: "Risk-Off Trend",
      resultR: 1.8,
      outcome: "WIN",
    },

    {
      id: "DEMO-003",
      market: "USOIL",
      strategy: "Inventory Reaction",
      resultR: -1.0,
      outcome: "LOSS",
    },
  ];
}