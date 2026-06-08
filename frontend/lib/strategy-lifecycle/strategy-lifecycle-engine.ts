import { generateMultiStrategyCompetitionReport } from "../multi-strategy-competition";
import {
  StrategyLifecycleEntry,
  StrategyLifecycleReport,
  StrategyLifecycleStatus,
} from "./strategy-lifecycle-types";

function resolveLifecycleStatus(
  score: number,
  confidence: number
): StrategyLifecycleStatus {

  if (score >= 85 && confidence >= 80) {
    return "PROMOTED";
  }

  if (score >= 70) {
    return "ACTIVE";
  }

  if (score >= 55) {
    return "WATCHLIST";
  }

  if (score >= 40) {
    return "DEGRADED";
  }

  return "ARCHIVED";
}

function buildReason(
  status: StrategyLifecycleStatus,
  score: number,
  confidence: number
): string {

  switch (status) {
    case "PROMOTED":
      return `High score ${score} and confidence ${confidence}.`;

    case "ACTIVE":
      return `Healthy score ${score}.`;

    case "WATCHLIST":
      return `Monitor performance. Score ${score}.`;

    case "DEGRADED":
      return `Weak performance. Score ${score}.`;

    case "ARCHIVED":
      return `Strategy archived due to low score ${score}.`;
  }
}

export function generateStrategyLifecycleReport(): StrategyLifecycleReport {

  const competitionReport =
    generateMultiStrategyCompetitionReport();

  const entries: StrategyLifecycleEntry[] =
    competitionReport.globalTopCompetitors.map(
      (competitor) => {

        const lifecycleScore =
          Math.round(
            competitor.competitionScore * 0.7 +
            competitor.confidenceScore * 0.3
          );

        const lifecycleStatus =
          resolveLifecycleStatus(
            lifecycleScore,
            competitor.confidenceScore
          );

        return {
          strategyId: competitor.strategyId,
          strategyName: competitor.strategyName,
          symbol: competitor.symbol,
          market: competitor.market,
          lifecycleStatus,
          lifecycleScore,
          competitionScore:
            competitor.competitionScore,
          decisionConfidence:
            competitor.confidenceScore,
          reason: buildReason(
            lifecycleStatus,
            lifecycleScore,
            competitor.confidenceScore
          ),
        };
      }
    );

  return {
    version: "V13.2.0",
    status: "READY",
    totalStrategies: entries.length,

    promotedStrategies:
      entries.filter(
        x => x.lifecycleStatus === "PROMOTED"
      ).length,

    activeStrategies:
      entries.filter(
        x => x.lifecycleStatus === "ACTIVE"
      ).length,

    watchlistStrategies:
      entries.filter(
        x => x.lifecycleStatus === "WATCHLIST"
      ).length,

    degradedStrategies:
      entries.filter(
        x => x.lifecycleStatus === "DEGRADED"
      ).length,

    archivedStrategies:
      entries.filter(
        x => x.lifecycleStatus === "ARCHIVED"
      ).length,

    entries,

    summary:
      "Strategy Lifecycle Engine manages promotion, degradation and archival of strategies based on competition results.",

    createdAt:
      new Date().toISOString(),
  };
}
