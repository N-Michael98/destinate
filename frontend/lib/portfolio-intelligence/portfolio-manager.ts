import { getSuggestedAllocations } from "./allocation-engine";
import { analyzeCorrelationRisk } from "./correlation-risk";
import {
  analyzePortfolioExposure,
  getMockPortfolioPositions,
} from "./exposure-analyzer";
import type { PortfolioSummary } from "./portfolio-types";

export function getPortfolioIntelligenceStatus() {
  return {
    status: "READY",
    portfolioFilterEnabled: true,
    liveTradingEnabled: false,
  };
}

export function getPortfolioPositions() {
  return getMockPortfolioPositions();
}

export function getPortfolioExposure() {
  return analyzePortfolioExposure();
}

export function getPortfolioCorrelationRisk() {
  return analyzeCorrelationRisk();
}

export function getPortfolioAllocationPlan() {
  return getSuggestedAllocations();
}

export function getPortfolioSummary(): PortfolioSummary {
  return {
    totalPositions: getMockPortfolioPositions().length,
    diversificationScore: 74,
    portfolioRisk: "MEDIUM",
    liveTradingEnabled: false,
  };
}

export function getPortfolioRoadmap() {
  return {
    currentPhase: "Portfolio Intelligence",

    nextSteps: [
      "AI Trading Brain",
      "OpenAI Integration",
      "Claude Integration",
      "TradingView Integration",
      "Forward Learning Live",
    ],
  };
}