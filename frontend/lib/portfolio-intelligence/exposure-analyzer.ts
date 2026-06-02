import type {
  PortfolioExposure,
  PortfolioPosition,
} from "./portfolio-types";

export function getMockPortfolioPositions(): PortfolioPosition[] {
  return [
    {
      id: "POS-001",
      market: "NAS100",
      assetClass: "INDEX",
      direction: "LONG",
      allocationPercent: 30,
      riskPercent: 1.2,
    },
    {
      id: "POS-002",
      market: "XAUUSD",
      assetClass: "COMMODITY",
      direction: "LONG",
      allocationPercent: 25,
      riskPercent: 0.9,
    },
    {
      id: "POS-003",
      market: "USOIL",
      assetClass: "COMMODITY",
      direction: "SHORT",
      allocationPercent: 15,
      riskPercent: 0.8,
    },
    {
      id: "POS-004",
      market: "EURUSD",
      assetClass: "FOREX",
      direction: "LONG",
      allocationPercent: 20,
      riskPercent: 0.7,
    },
  ];
}

export function analyzePortfolioExposure(): PortfolioExposure[] {
  return [
    {
      assetClass: "INDEX",
      exposurePercent: 30,
      riskLevel: "MEDIUM",
    },
    {
      assetClass: "COMMODITY",
      exposurePercent: 40,
      riskLevel: "MEDIUM",
    },
    {
      assetClass: "FOREX",
      exposurePercent: 20,
      riskLevel: "LOW",
    },
    {
      assetClass: "CASH",
      exposurePercent: 10,
      riskLevel: "LOW",
    },
  ];
}