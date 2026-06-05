import type { BrainInput } from "./brain-types";
import { getPortfolioIntelligenceReport } from "@/lib/portfolio-intelligence";

export function getBrainInputs(): BrainInput[] {
  const portfolio = getPortfolioIntelligenceReport();

  const portfolioSignal =
    portfolio.summary.portfolioRiskScore >= 85
      ? "BLOCK"
      : portfolio.summary.portfolioRiskScore >= 70
        ? "WAIT"
        : portfolio.summary.portfolioRiskScore >= 45
          ? "WAIT"
          : "LONG";

  return [
    {
      source: "GPT",
      signal: "LONG",
      confidence: 84,
      riskScore: 35,
      reason: "Momentum breakout detected.",
    },
    {
      source: "CLAUDE",
      signal: "LONG",
      confidence: 80,
      riskScore: 42,
      reason: "Risk acceptable under current mock validation.",
    },
    {
      source: "AGENT",
      signal: "LONG",
      confidence: 78,
      riskScore: 45,
      reason: "Execution plan valid in simulation mode.",
    },
    {
      source: "REGIME",
      signal: "LONG",
      confidence: 76,
      riskScore: 50,
      reason: "Market regime allows directional bias.",
    },
    {
      source: "PORTFOLIO",
      signal: portfolioSignal,
      confidence: portfolio.summary.portfolioHealth,
      riskScore: portfolio.summary.portfolioRiskScore,
      reason: portfolio.summary.aiRecommendation,
    },
  ];
}