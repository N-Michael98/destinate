import { buildOpportunityScannerReport } from "./opportunity-scanner";

export type DynamicMarketChart = {
  rank: number;
  symbol: string;
  displayName: string;
  assetClass: string;
  tradingViewSymbol: string;
  direction: string;
  confidence: number;
  opportunityScore: number;
  regime: string;
};

export type DynamicMarketDataReport = {
  version: string;
  status: "READY";
  totalCharts: number;
  charts: DynamicMarketChart[];
  updatedAt: string;
};

export function buildDynamicMarketDataReport(): DynamicMarketDataReport {
  const scanner = buildOpportunityScannerReport();

  const charts = scanner.topOpportunities.map((item) => ({
    rank: item.rank,
    symbol: item.symbol,
    displayName: item.displayName,
    assetClass: item.assetClass,
    tradingViewSymbol: item.tradingViewSymbol,
    direction: item.direction,
    confidence: item.confidence,
    opportunityScore: item.opportunityScore,
    regime: item.regime,
  }));

  return {
    version: "V11.4.7",
    status: "READY",
    totalCharts: charts.length,
    charts,
    updatedAt: new Date().toISOString(),
  };
}