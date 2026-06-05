export type PortfolioAssetClass =
  | "INDEX"
  | "FOREX"
  | "COMMODITY"
  | "CRYPTO"
  | "STOCK"
  | "CASH";

export type PortfolioDirection =
  | "LONG"
  | "SHORT"
  | "NEUTRAL";

export type PortfolioRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

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
  riskLevel: PortfolioRiskLevel;
};

export type PortfolioCorrelation = {
  pair: string;
  correlationRisk: PortfolioRiskLevel;
  reason: string;
};

export type PortfolioAllocation = {
  market: string;
  suggestedAllocationPercent: number;
  reason: string;
};

export type PortfolioSummary = {
  version: string;
  totalPositions: number;
  diversificationScore: number;
  portfolioRisk: PortfolioRiskLevel;
  portfolioRiskScore: number;
  concentrationScore: number;
  portfolioHealth: number;
  highestExposureAssetClass: PortfolioAssetClass | null;
  highestExposurePercent: number;
  highCorrelationPairs: number;
  mediumCorrelationPairs: number;
  totalSuggestedAllocation: number;
  aiRecommendation: string;
  liveTradingEnabled: false;
  updatedAt: string;
};

export type PortfolioIntelligenceReport = {
  version: string;
  status: "READY";
  portfolioFilterEnabled: boolean;
  liveTradingEnabled: false;
  positions: PortfolioPosition[];
  exposure: PortfolioExposure[];
  correlationRisk: PortfolioCorrelation[];
  allocationPlan: PortfolioAllocation[];
  summary: PortfolioSummary;
  roadmap: {
    currentPhase: string;
    nextSteps: string[];
  };
  generatedAt: string;
};