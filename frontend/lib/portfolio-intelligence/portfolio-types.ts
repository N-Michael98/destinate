export type PortfolioAssetClass =
  | "INDEX"
  | "FOREX"
  | "COMMODITY"
  | "CRYPTO"
  | "STOCK"
  | "CASH";

export type PortfolioDirection = "LONG" | "SHORT" | "NEUTRAL";

export type PortfolioPosition = {
  id: string;
  market: string;
  assetClass: PortfolioAssetClass;
  direction: PortfolioDirection;
  allocationPercent: number;
  riskPercent: number;
};

export type PortfolioExposure = {
  assetClass: PortfolioAssetClass;
  exposurePercent: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

export type PortfolioCorrelation = {
  pair: string;
  correlationRisk: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
};

export type PortfolioAllocation = {
  market: string;
  suggestedAllocationPercent: number;
  reason: string;
};

export type PortfolioSummary = {
  totalPositions: number;
  diversificationScore: number;
  portfolioRisk: "LOW" | "MEDIUM" | "HIGH";
  liveTradingEnabled: false;
};