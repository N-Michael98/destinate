import type { PortfolioCorrelation } from "./portfolio-types";

export function analyzeCorrelationRisk(): PortfolioCorrelation[] {
  return [
    {
      pair: "NAS100 / SPX500",
      correlationRisk: "HIGH",
      reason:
        "Both markets are equity-index sensitive and may move together during risk-on or risk-off conditions.",
    },
    {
      pair: "EURUSD / GBPUSD",
      correlationRisk: "MEDIUM",
      reason:
        "Both pairs can share USD exposure and may react similarly to dollar strength or weakness.",
    },
    {
      pair: "XAUUSD / USOIL",
      correlationRisk: "LOW",
      reason:
        "Gold and crude oil often react to different macro drivers, improving diversification.",
    },
  ];
}