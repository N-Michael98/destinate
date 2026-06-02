import type { AgentPlan } from "./agent-types";

export function generateTradePlans(): AgentPlan[] {
  return [
    {
      id: "PLAN-001",
      market: "NAS100",
      setup: "Momentum Breakout",
      confidence: 83,
    },
    {
      id: "PLAN-002",
      market: "XAUUSD",
      setup: "Risk-Off Trend",
      confidence: 78,
    },
    {
      id: "PLAN-003",
      market: "USOIL",
      setup: "Inventory Reaction",
      confidence: 71,
    },
  ];
}