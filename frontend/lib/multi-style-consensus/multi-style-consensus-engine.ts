import { getTradingStylePriorityEngineReport } from "@/lib/trading-style-priority-engine";

import {
  MultiStyleConsensusDecision,
  MultiStyleConsensusLevel,
  MultiStyleConsensusReport,
  MultiStyleConsensusStatus,
  MultiStyleConsensusStyleVote,
  TradingStyle,
} from "./multi-style-consensus-types";

const VERSION = "V16.1.0" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveConsensusLevel(goCount: number): MultiStyleConsensusLevel {
  if (goCount >= 3) return "ELITE_CONFIDENCE";
  if (goCount === 2) return "HIGH_CONFIDENCE";
  if (goCount === 1) return "LOW_CONFIDENCE";
  return "NO_CONSENSUS";
}

function resolveConsensusStatus(params: {
  goCount: number;
  requiresStrictApproval: boolean;
}): MultiStyleConsensusStatus {
  if (params.goCount === 0) return "BLOCKED";
  if (params.requiresStrictApproval) return "STRICT_APPROVAL_REQUIRED";
  return "TRADE_ALLOWED";
}

function calculateConsensusScore(votes: MultiStyleConsensusStyleVote[]) {
  const approvedVotes = votes.filter((vote) => vote.approved);

  if (approvedVotes.length === 0) return 0;

  const averagePriority =
    approvedVotes.reduce((sum, vote) => sum + vote.priorityScore, 0) /
    approvedVotes.length;

  const averageConfidence =
    approvedVotes.reduce((sum, vote) => sum + vote.confidenceScore, 0) /
    approvedVotes.length;

  const averageRisk =
    approvedVotes.reduce((sum, vote) => sum + vote.riskScore, 0) /
    approvedVotes.length;

  const goBoost = approvedVotes.length * 9;

  return clamp(
    Math.round(
      averagePriority * 0.45 +
        averageConfidence * 0.3 +
        (100 - averageRisk) * 0.15 +
        goBoost
    ),
    0,
    100
  );
}

function resolvePositionMultiplier(params: {
  consensusLevel: MultiStyleConsensusLevel;
  strict: boolean;
}) {
  if (params.consensusLevel === "ELITE_CONFIDENCE") return params.strict ? 0.65 : 1;
  if (params.consensusLevel === "HIGH_CONFIDENCE") return params.strict ? 0.5 : 0.8;
  if (params.consensusLevel === "LOW_CONFIDENCE") return params.strict ? 0.3 : 0.45;
  return 0;
}

function buildReason(params: {
  symbol: string;
  goCount: number;
  consensusLevel: MultiStyleConsensusLevel;
  primaryStyle: TradingStyle | "NONE";
  secondaryStyle: TradingStyle | "NONE";
}) {
  if (params.goCount === 0) {
    return `${params.symbol}: No trading style has GO. Consensus blocks trade routing.`;
  }

  return `${params.symbol}: ${params.goCount} trading style(s) confirmed GO. Consensus=${params.consensusLevel}. Primary=${params.primaryStyle}, Secondary=${params.secondaryStyle}.`;
}

export function generateMultiStyleConsensusReport(): MultiStyleConsensusReport {
  const stylePriority = getTradingStylePriorityEngineReport();

  const decisions: MultiStyleConsensusDecision[] = stylePriority.results.map(
    (result) => {
      const votes: MultiStyleConsensusStyleVote[] = result.decisions.map((decision) => {
        const approved =
          decision.status === "APPROVED" ||
          decision.status === "STRICT_APPROVAL_REQUIRED";

        return {
          symbol: decision.symbol,
          style: decision.style,
          direction: decision.direction,
          approved,
          strictApprovalRequired: decision.status === "STRICT_APPROVAL_REQUIRED",
          priorityScore: decision.priorityScore,
          confidenceScore: decision.confidenceScore,
          riskScore: decision.riskScore,
          finalPositionSize: decision.finalPositionSize,
          reason: decision.reason,
        };
      });

      const approvedVotes = votes.filter((vote) => vote.approved);
      const strictApprovalStyles = votes
        .filter((vote) => vote.strictApprovalRequired)
        .map((vote) => vote.style);

      const goCount = approvedVotes.length;
      const consensusLevel = resolveConsensusLevel(goCount);
      const consensusScore = calculateConsensusScore(votes);
      const consensusStatus = resolveConsensusStatus({
        goCount,
        requiresStrictApproval: strictApprovalStyles.length > 0,
      });

      const recommendedPositionMultiplier = resolvePositionMultiplier({
        consensusLevel,
        strict: consensusStatus === "STRICT_APPROVAL_REQUIRED",
      });

      const basePositionSize =
        approvedVotes.length === 0
          ? 0
          : Math.max(...approvedVotes.map((vote) => vote.finalPositionSize));

      const recommendedFinalPositionSize = Number(
        (basePositionSize * recommendedPositionMultiplier).toFixed(2)
      );

      return {
        id: `multi-style-consensus-${result.symbol.toLowerCase()}`,
        symbol: result.symbol,
        primaryStyle: result.primaryStyle,
        secondaryStyle: result.secondaryStyle,
        activeDirection: result.activeDirection,
        goCount,
        consensusLevel,
        consensusScore,
        consensusStatus,
        approvedStyles: approvedVotes.map((vote) => vote.style),
        strictApprovalStyles,
        waitingStyles: result.waitingStyles,
        rejectedStyles: result.rejectedStyles,
        blockedStyles: result.blockedStyles,
        recommendedPositionMultiplier,
        recommendedFinalPositionSize,
        votes,
        reason: buildReason({
          symbol: result.symbol,
          goCount,
          consensusLevel,
          primaryStyle: result.primaryStyle,
          secondaryStyle: result.secondaryStyle,
        }),
      };
    }
  );

  const tradeAllowedSymbols = decisions.filter(
    (decision) => decision.consensusStatus === "TRADE_ALLOWED"
  ).length;

  const strictApprovalSymbols = decisions.filter(
    (decision) => decision.consensusStatus === "STRICT_APPROVAL_REQUIRED"
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.consensusStatus === "BLOCKED"
  ).length;

  const lowConfidenceSymbols = decisions.filter(
    (decision) => decision.consensusLevel === "LOW_CONFIDENCE"
  ).length;

  const highConfidenceSymbols = decisions.filter(
    (decision) => decision.consensusLevel === "HIGH_CONFIDENCE"
  ).length;

  const eliteConfidenceSymbols = decisions.filter(
    (decision) => decision.consensusLevel === "ELITE_CONFIDENCE"
  ).length;

  const recommendation =
    eliteConfidenceSymbols > 0
      ? "Elite multi-style consensus detected. Route strongest symbols with full validation."
      : highConfidenceSymbols > 0
        ? "High multi-style consensus detected. Route confirmed symbols with normal validation."
        : lowConfidenceSymbols > 0
          ? "Low multi-style consensus detected. Route only with reduced size or strict approval."
          : "No multi-style consensus available. Keep execution blocked.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    tradeAllowedSymbols,
    strictApprovalSymbols,
    blockedSymbols,
    lowConfidenceSymbols,
    highConfidenceSymbols,
    eliteConfidenceSymbols,
    decisions,
    systemRule:
      "Multi-Style Consensus keeps existing primary/secondary style routing intact while adding 1-GO, 2-GO and 3-GO confirmation logic for trade approval quality.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
