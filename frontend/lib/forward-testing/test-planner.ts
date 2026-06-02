import type { ForwardTestPlan } from "./test-types";

export function generateMockForwardTests(): ForwardTestPlan[] {
  const now = new Date().toISOString();

  return [
    {
      id: "ft-001",
      market: "NAS100",
      strategy: "Momentum Breakout",
      direction: "LONG",
      confidence: 83,
      plannedAt: now,
      status: "PLANNED",
    },
    {
      id: "ft-002",
      market: "XAUUSD",
      strategy: "Risk-Off Trend",
      direction: "LONG",
      confidence: 78,
      plannedAt: now,
      status: "PLANNED",
    },
    {
      id: "ft-003",
      market: "USOIL",
      strategy: "Inventory Reaction",
      direction: "SHORT",
      confidence: 71,
      plannedAt: now,
      status: "PLANNED",
    },
  ];
}