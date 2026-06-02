import type { PortfolioAllocation } from "./portfolio-types";

export function getSuggestedAllocations(): PortfolioAllocation[] {
  return [
    {
      market: "NAS100",
      suggestedAllocationPercent: 30,
      reason:
        "Momentum strategy has strong performance but equity exposure must stay controlled.",
    },
    {
      market: "XAUUSD",
      suggestedAllocationPercent: 25,
      reason:
        "Gold adds risk-off hedge characteristics and balances index exposure.",
    },
    {
      market: "USOIL",
      suggestedAllocationPercent: 15,
      reason:
        "Oil provides macro diversification but remains news-sensitive.",
    },
    {
      market: "EURUSD",
      suggestedAllocationPercent: 20,
      reason:
        "Forex exposure provides diversification against index and commodity positions.",
    },
    {
      market: "RESERVE",
      suggestedAllocationPercent: 10,
      reason:
        "Reserve allocation keeps the portfolio flexible and reduces overexposure.",
    },
  ];
}