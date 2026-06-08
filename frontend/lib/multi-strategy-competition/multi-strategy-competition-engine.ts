import { generateStrategyRankingReport } from "../strategy-ranking";

import {
  MarketStrategyCompetition,
  MultiStrategyCompetitionReport,
  MultiStrategyCompetitionStatus,
  StrategyCompetitor,
} from "./multi-strategy-competition-types";

const VERSION = "V13.1.0" as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function calculateCompetitionScore(params: {
  finalStrategyScore: number;
  confidenceScore: number;
  brokerFitScore: number;
  marketFitScore: number;
  riskFitScore: number;
  originalRank: number;
}): number {
  const rankBoost = clamp(100 - params.originalRank * 0.8, 0, 100);

  return clamp(
    round0(
      params.finalStrategyScore * 0.45 +
        params.confidenceScore * 0.2 +
        params.brokerFitScore * 0.15 +
        params.marketFitScore * 0.1 +
        params.riskFitScore * 0.05 +
        rankBoost * 0.05
    ),
    0,
    100
  );
}

function resolveCompetitorStatus(
  score: number
): MultiStrategyCompetitionStatus {
  if (score >= 75) return "WINNER_SELECTED";
  if (score >= 65) return "READY";
  if (score >= 55) return "WATCHLIST";
  return "BLOCKED";
}

function resolveCompetitorRecommendation(params: {
  position: number;
  competitionScore: number;
}): "WINNER" | "RUNNER_UP" | "VALID" | "WATCHLIST" | "AVOID" {
  if (params.position === 1 && params.competitionScore >= 65) {
    return "WINNER";
  }

  if (params.position === 2 && params.competitionScore >= 60) {
    return "RUNNER_UP";
  }

  if (params.competitionScore >= 65) {
    return "VALID";
  }

  if (params.competitionScore >= 55) {
    return "WATCHLIST";
  }

  return "AVOID";
}

function buildCompetitorReasons(params: {
  strategyName: string;
  competitionScore: number;
  finalStrategyScore: number;
  confidenceScore: number;
  brokerFitScore: number;
  recommendation: string;
}): string[] {
  return [
    `${params.strategyName} competition score is ${params.competitionScore}.`,
    `Final strategy score ${params.finalStrategyScore}, confidence ${params.confidenceScore}.`,
    `Broker fit score ${params.brokerFitScore}.`,
    `Competition recommendation resolved as ${params.recommendation}.`,
  ];
}

function buildCompetitorsForMarket(input: {
  market: string;
  symbol: string;
}): StrategyCompetitor[] {
  const rankingReport = generateStrategyRankingReport();

  const profiles = rankingReport.rankingProfiles.filter(
    (profile) => profile.market === input.market && profile.symbol === input.symbol
  );

  const deduped = new Map<string, (typeof profiles)[number]>();

  for (const profile of profiles) {
    const key = `${profile.strategyId}-${profile.tradingStyle}`;

    const existing = deduped.get(key);

    if (!existing || profile.finalStrategyScore > existing.finalStrategyScore) {
      deduped.set(key, profile);
    }
  }

  return Array.from(deduped.values())
    .map((profile) => {
      const competitionScore = calculateCompetitionScore({
        finalStrategyScore: profile.finalStrategyScore,
        confidenceScore: profile.confidenceScore,
        brokerFitScore: profile.brokerFitScore,
        marketFitScore: profile.marketFitScore,
        riskFitScore: profile.riskFitScore,
        originalRank: profile.rank,
      });

      return {
        strategyId: profile.strategyId,
        strategyType: profile.strategyType,
        strategyName: profile.strategyName,
        market: profile.market,
        symbol: profile.symbol,
        tradingStyle: profile.tradingStyle,
        originalRank: profile.rank,
        finalStrategyScore: profile.finalStrategyScore,
        winRateScore: profile.winRateScore,
        profitFactorScore: profile.profitFactorScore,
        drawdownScore: profile.drawdownScore,
        marketFitScore: profile.marketFitScore,
        brokerFitScore: profile.brokerFitScore,
        riskFitScore: profile.riskFitScore,
        confidenceScore: profile.confidenceScore,
        competitionScore,
        competitionPosition: 0,
        status: resolveCompetitorStatus(competitionScore),
        recommendation: "VALID",
        reasons: [],
      } satisfies StrategyCompetitor;
    })
    .sort((a, b) => b.competitionScore - a.competitionScore)
    .map((competitor, index) => {
      const competitionPosition = index + 1;
      const recommendation = resolveCompetitorRecommendation({
        position: competitionPosition,
        competitionScore: competitor.competitionScore,
      });

      return {
        ...competitor,
        competitionPosition,
        recommendation,
        reasons: buildCompetitorReasons({
          strategyName: competitor.strategyName,
          competitionScore: competitor.competitionScore,
          finalStrategyScore: competitor.finalStrategyScore,
          confidenceScore: competitor.confidenceScore,
          brokerFitScore: competitor.brokerFitScore,
          recommendation,
        }),
      };
    });
}

function calculateDecisionConfidence(params: {
  winnerScore: number;
  runnerUpScore: number;
  totalCompetitors: number;
}): number {
  const scoreGap = params.winnerScore - params.runnerUpScore;
  const competitorBonus = Math.min(params.totalCompetitors * 3, 18);

  return clamp(round0(55 + scoreGap * 3 + competitorBonus), 0, 100);
}

function resolveCompetitionStatus(params: {
  winnerScore: number;
  scoreGap: number;
  decisionConfidence: number;
}): MultiStrategyCompetitionStatus {
  if (params.winnerScore < 55) return "BLOCKED";
  if (params.scoreGap < 3 || params.decisionConfidence < 65) {
    return "NO_CLEAR_WINNER";
  }

  if (params.winnerScore >= 65) {
    return "WINNER_SELECTED";
  }

  return "WATCHLIST";
}

function buildCompetitionReasons(params: {
  winnerStrategyName: string;
  winnerScore: number;
  runnerUpStrategyName: string;
  runnerUpScore: number;
  scoreGap: number;
  decisionConfidence: number;
  status: MultiStrategyCompetitionStatus;
}): string[] {
  return [
    `${params.winnerStrategyName} wins with competition score ${params.winnerScore}.`,
    `Runner-up is ${params.runnerUpStrategyName} with score ${params.runnerUpScore}.`,
    `Score gap is ${params.scoreGap}, decision confidence is ${params.decisionConfidence}.`,
    `Competition status resolved as ${params.status}.`,
  ];
}

function buildCompetitions(): MarketStrategyCompetition[] {
  const rankingReport = generateStrategyRankingReport();

  const keys = Array.from(
    new Set(
      rankingReport.rankingProfiles.map(
        (profile) => `${profile.market}|${profile.symbol}`
      )
    )
  );

  return keys
    .map((key) => {
      const [market, symbol] = key.split("|");

      const competitors = buildCompetitorsForMarket({
        market,
        symbol,
      });

      const winner = competitors[0];
      const runnerUp = competitors[1];

      const winnerScore = winner?.competitionScore ?? 0;
      const runnerUpScore = runnerUp?.competitionScore ?? 0;
      const scoreGap = winnerScore - runnerUpScore;

      const decisionConfidence = calculateDecisionConfidence({
        winnerScore,
        runnerUpScore,
        totalCompetitors: competitors.length,
      });

      const status = resolveCompetitionStatus({
        winnerScore,
        scoreGap,
        decisionConfidence,
      });

      return {
        market: winner?.market ?? "GOLD",
        symbol,
        totalCompetitors: competitors.length,
        winnerStrategyId: winner?.strategyId ?? "NONE",
        winnerStrategyName: winner?.strategyName ?? "NONE",
        winnerTradingStyle: winner?.tradingStyle ?? "DAYTRADING",
        winnerScore,
        runnerUpStrategyId: runnerUp?.strategyId ?? "NONE",
        runnerUpStrategyName: runnerUp?.strategyName ?? "NONE",
        runnerUpScore,
        scoreGap,
        decisionConfidence,
        status,
        competitors,
        reasons: buildCompetitionReasons({
          winnerStrategyName: winner?.strategyName ?? "NONE",
          winnerScore,
          runnerUpStrategyName: runnerUp?.strategyName ?? "NONE",
          runnerUpScore,
          scoreGap,
          decisionConfidence,
          status,
        }),
      } satisfies MarketStrategyCompetition;
    })
    .sort((a, b) => b.winnerScore - a.winnerScore);
}

function resolveReportStatus(
  competitions: MarketStrategyCompetition[]
): MultiStrategyCompetitionStatus {
  if (competitions.every((competition) => competition.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (competitions.some((competition) => competition.status === "WINNER_SELECTED")) {
    return "WINNER_SELECTED";
  }

  if (competitions.some((competition) => competition.status === "NO_CLEAR_WINNER")) {
    return "NO_CLEAR_WINNER";
  }

  return "READY";
}

function buildGlobalTopCompetitors(
  competitions: MarketStrategyCompetition[]
): StrategyCompetitor[] {
  return competitions
    .flatMap((competition) => competition.competitors)
    .sort((a, b) => b.competitionScore - a.competitionScore)
    .slice(0, 15);
}

function buildCompetitionNotes(
  competitions: MarketStrategyCompetition[]
): string[] {
  return competitions.slice(0, 8).map((competition) => {
    return `${competition.market} ${competition.symbol}: ${competition.winnerStrategyName} wins with score ${competition.winnerScore}, confidence ${competition.decisionConfidence}.`;
  });
}

export function generateMultiStrategyCompetitionReport(): MultiStrategyCompetitionReport {
  const competitions = buildCompetitions();
  const globalTopCompetitors = buildGlobalTopCompetitors(competitions);

  const strongestWinner = competitions[0];
  const weakestWinner = [...competitions]
    .filter((competition) => competition.winnerScore > 0)
    .sort((a, b) => a.winnerScore - b.winnerScore)[0];

  return {
    version: VERSION,
    status: resolveReportStatus(competitions),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalMarkets: competitions.length,
    totalCompetitors: competitions.reduce(
      (sum, competition) => sum + competition.totalCompetitors,
      0
    ),
    winnersSelected: competitions.filter(
      (competition) => competition.status === "WINNER_SELECTED"
    ).length,
    noClearWinnerMarkets: competitions.filter(
      (competition) => competition.status === "NO_CLEAR_WINNER"
    ).length,
    strongestWinner: strongestWinner
      ? `${strongestWinner.winnerStrategyName} ${strongestWinner.symbol}`
      : "NONE",
    weakestWinner: weakestWinner
      ? `${weakestWinner.winnerStrategyName} ${weakestWinner.symbol}`
      : "NONE",
    competitions,
    globalTopCompetitors,
    summary:
      "Multi-Strategy Competition compared ranked strategies per market and symbol to select simulated winning strategies for future trade candidates.",
    competitionNotes: buildCompetitionNotes(competitions),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      competitionMode: "SIMULATED_MULTI_STRATEGY_COMPETITION",
    },
    createdAt: new Date().toISOString(),
  };
}
