import { getSuggestedAllocations } from "./allocation-engine";
import { analyzeCorrelationRisk } from "./correlation-risk";
import {
  analyzePortfolioExposure,
  getMockPortfolioPositions,
} from "./exposure-analyzer";
import type {
  PortfolioAssetClass,
  PortfolioIntelligenceReport,
  PortfolioRiskLevel,
  PortfolioSummary,
} from "./portfolio-types";

function getRiskScoreFromLevel(level: PortfolioRiskLevel) {
  if (level === "HIGH") return 80;
  if (level === "MEDIUM") return 50;
  return 20;
}

function calculateDiversificationScore() {
  const exposure = analyzePortfolioExposure();

  const activeAssetClasses = exposure.filter(
    (item) => item.exposurePercent > 0
  ).length;

  const highestExposure =
    exposure.length > 0
      ? Math.max(...exposure.map((item) => item.exposurePercent))
      : 0;

  const assetClassScore = Math.min(100, activeAssetClasses * 22);

  const concentrationPenalty =
    highestExposure >= 60
      ? 35
      : highestExposure >= 45
        ? 20
        : highestExposure >= 35
          ? 10
          : 0;

  return Math.max(
    0,
    Math.min(100, assetClassScore - concentrationPenalty)
  );
}

function calculateConcentrationScore() {
  const exposure = analyzePortfolioExposure();

  if (exposure.length === 0) return 0;

  const highestExposure = Math.max(
    ...exposure.map((item) => item.exposurePercent)
  );

  return Math.min(100, Math.round(highestExposure * 1.4));
}

function calculatePortfolioRiskScore() {
  const positions = getMockPortfolioPositions();
  const exposure = analyzePortfolioExposure();
  const correlations = analyzeCorrelationRisk();

  const totalPositionRisk = positions.reduce(
    (sum, position) => sum + position.riskPercent,
    0
  );

  const averageExposureRisk =
    exposure.length > 0
      ? exposure.reduce(
          (sum, item) => sum + getRiskScoreFromLevel(item.riskLevel),
          0
        ) / exposure.length
      : 0;

  const highCorrelationPenalty =
    correlations.filter((item) => item.correlationRisk === "HIGH").length * 12;

  const mediumCorrelationPenalty =
    correlations.filter((item) => item.correlationRisk === "MEDIUM").length * 6;

  const positionRiskComponent = totalPositionRisk * 8;

  return Math.min(
    100,
    Math.round(
      positionRiskComponent +
        averageExposureRisk * 0.45 +
        highCorrelationPenalty +
        mediumCorrelationPenalty
    )
  );
}

function getPortfolioRiskLevel(score: number): PortfolioRiskLevel {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function getHighestExposure() {
  const exposure = analyzePortfolioExposure();

  if (exposure.length === 0) {
    return {
      assetClass: null as PortfolioAssetClass | null,
      percent: 0,
    };
  }

  const highest = [...exposure].sort(
    (a, b) => b.exposurePercent - a.exposurePercent
  )[0];

  return {
    assetClass: highest.assetClass,
    percent: highest.exposurePercent,
  };
}

function calculatePortfolioHealth(
  diversificationScore: number,
  portfolioRiskScore: number,
  concentrationScore: number
) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        diversificationScore * 0.45 +
          (100 - portfolioRiskScore) * 0.35 +
          (100 - concentrationScore) * 0.2
      )
    )
  );
}

function getAIRecommendation(
  portfolioRisk: PortfolioRiskLevel,
  portfolioHealth: number,
  concentrationScore: number
) {
  if (portfolioRisk === "HIGH" || portfolioHealth < 45) {
    return "Portfolio risk is elevated. Reduce correlated exposure, lower position risk and keep reserve allocation protected.";
  }

  if (concentrationScore >= 60) {
    return "Portfolio concentration is noticeable. Reduce the largest exposure and rebalance toward reserve or lower-correlated markets.";
  }

  if (portfolioHealth >= 75) {
    return "Portfolio structure is healthy. Keep current allocation and continue monitoring correlation risk.";
  }

  return "Portfolio risk is balanced but still needs monitoring. Maintain diversification and avoid adding highly correlated positions.";
}

export function getPortfolioIntelligenceStatus() {
  return {
    version: "V11.2.0",
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
  const positions = getMockPortfolioPositions();
  const exposure = analyzePortfolioExposure();
  const correlations = analyzeCorrelationRisk();
  const allocationPlan = getSuggestedAllocations();

  const diversificationScore = calculateDiversificationScore();
  const concentrationScore = calculateConcentrationScore();
  const portfolioRiskScore = calculatePortfolioRiskScore();
  const portfolioRisk = getPortfolioRiskLevel(portfolioRiskScore);
  const highestExposure = getHighestExposure();

  const portfolioHealth = calculatePortfolioHealth(
    diversificationScore,
    portfolioRiskScore,
    concentrationScore
  );

  const totalSuggestedAllocation = allocationPlan.reduce(
    (sum, item) => sum + item.suggestedAllocationPercent,
    0
  );

  const highCorrelationPairs = correlations.filter(
    (item) => item.correlationRisk === "HIGH"
  ).length;

  const mediumCorrelationPairs = correlations.filter(
    (item) => item.correlationRisk === "MEDIUM"
  ).length;

  return {
    version: "V11.2.0",
    totalPositions: positions.length,
    diversificationScore,
    portfolioRisk,
    portfolioRiskScore,
    concentrationScore,
    portfolioHealth,
    highestExposureAssetClass: highestExposure.assetClass,
    highestExposurePercent: highestExposure.percent,
    highCorrelationPairs,
    mediumCorrelationPairs,
    totalSuggestedAllocation,
    aiRecommendation: getAIRecommendation(
      portfolioRisk,
      portfolioHealth,
      concentrationScore
    ),
    liveTradingEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}

export function getPortfolioRoadmap() {
  return {
    currentPhase: "Portfolio Intelligence V11.2.0",

    nextSteps: [
      "Portfolio Intelligence Panel",
      "Portfolio Brain Integration into AI Agent",
      "OpenAI Integration",
      "Claude Integration",
      "TradingView Integration",
      "Forward Learning Live",
    ],
  };
}

export function getPortfolioIntelligenceReport(): PortfolioIntelligenceReport {
  return {
    version: "V11.2.0",
    status: "READY",
    portfolioFilterEnabled: true,
    liveTradingEnabled: false,
    positions: getPortfolioPositions(),
    exposure: getPortfolioExposure(),
    correlationRisk: getPortfolioCorrelationRisk(),
    allocationPlan: getPortfolioAllocationPlan(),
    summary: getPortfolioSummary(),
    roadmap: getPortfolioRoadmap(),
    generatedAt: new Date().toISOString(),
  };
}