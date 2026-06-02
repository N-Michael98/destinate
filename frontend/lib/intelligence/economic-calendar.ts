import type { MacroEvent } from "./news-types";

export function getMockMacroCalendar(): MacroEvent[] {
  const expectedAt = new Date().toISOString();

  return [
    {
      id: "macro-fomc",
      name: "FOMC Rate Decision",
      region: "US",
      impact: "HIGH",
      relatedMarkets: ["NAS100", "XAUUSD", "EURUSD"],
      expectedAt,
      status: "UPCOMING",
    },
    {
      id: "macro-cpi",
      name: "US CPI",
      region: "US",
      impact: "HIGH",
      relatedMarkets: ["NAS100", "XAUUSD", "EURUSD"],
      expectedAt,
      status: "UPCOMING",
    },
    {
      id: "macro-oil-inventories",
      name: "Crude Oil Inventories",
      region: "US",
      impact: "MEDIUM",
      relatedMarkets: ["USOIL"],
      expectedAt,
      status: "UPCOMING",
    },
  ];
}