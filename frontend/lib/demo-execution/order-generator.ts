import type { DemoOrder } from "./execution-types";

export function generateMockOrders(): DemoOrder[] {
  return [
    {
      id: "DEMO-001",
      market: "NAS100",
      direction: "LONG",
      entry: 22000,
      stopLoss: 21880,
      takeProfit: 22300,
      confidence: 83,
    },
    {
      id: "DEMO-002",
      market: "XAUUSD",
      direction: "LONG",
      entry: 3400,
      stopLoss: 3375,
      takeProfit: 3460,
      confidence: 78,
    },
    {
      id: "DEMO-003",
      market: "USOIL",
      direction: "SHORT",
      entry: 67,
      stopLoss: 68.2,
      takeProfit: 64.2,
      confidence: 71,
    },
  ];
}