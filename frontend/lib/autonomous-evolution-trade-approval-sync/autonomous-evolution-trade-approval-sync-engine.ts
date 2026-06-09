import { buildTradeApprovalEngineReport } from "@/lib/portfolio-brain/trade-approval-engine";
import { generateAutonomousEvolutionStrategyWeightSyncReport } from "@/lib/autonomous-evolution-strategy-weight-sync";
import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";

import {
  AutonomousEvolutionTradeApprovalDecision,
  AutonomousEvolutionTradeApprovalImpact,
  AutonomousEvolutionTradeApprovalSyncReport,
} from "./autonomous-evolution-trade-approval-sync-types";

const VERSION = "V16.0.7" as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function findAutonomousWeight(params: {
  strategy: string;
  symbol: string;
  decisions: ReturnType<
    typeof generateAutonomousEvolutionStrategyWeightSyncReport
  >["decisions"];
}) {
  return params.decisions.find(
    (item) =>
      item.strategy === params.strategy &&
      item.symbol === params.symbol
  );
}

function resolveApprovalImpact(params: {
  baseApproved: boolean;
  cycleDecision: string;
  autonomousWeightStatus?: string;
  autonomousWeightChange: number;
  autonomousEvolutionScore: number;
}): AutonomousEvolutionTradeApprovalImpact {
  if (params.cycleDecision === "PAUSE_EVOLUTION") return "BLOCK_APPROVAL";
  if (params.autonomousWeightStatus === "BLOCK") return "BLOCK_APPROVAL";

  if (params.cycleDecision === "REDUCE_RISK") return "STRICT_APPROVAL";

  if (!params.baseApproved) {
    return params.autonomousWeightStatus === "BOOST" &&
      params.autonomousEvolutionScore >= 70
      ? "STRICT_APPROVAL"
      : "BLOCK_APPROVAL";
  }

  if (
    params.autonomousWeightStatus === "BOOST" &&
    params.autonomousWeightChange > 0 &&
    params.autonomousEvolutionScore >= 70
  ) {
    return "BOOST_APPROVAL";
  }

  if (params.autonomousWeightStatus === "REDUCE") return "STRICT_APPROVAL";

  return "NORMAL_APPROVAL";
}

function resolvePositionSizingBias(
  impact: AutonomousEvolutionTradeApprovalImpact
): AutonomousEvolutionTradeApprovalDecision["positionSizingBias"] {
  if (impact === "BOOST_APPROVAL") return "ALLOW_SIZE_INCREASE";
  if (impact === "STRICT_APPROVAL") return "REDUCE_SIZE";
  if (impact === "BLOCK_APPROVAL") return "BLOCK_SIZE";
  return "NORMAL_SIZE";
}

function resolveFinalStatus(params: {
  impact: AutonomousEvolutionTradeApprovalImpact;
  baseApproved: boolean;
}): AutonomousEvolutionTradeApprovalDecision["finalStatus"] {
  if (params.impact === "BLOCK_APPROVAL") return "BLOCKED";
  if (!params.baseApproved) return "REVIEW";
  if (params.impact === "STRICT_APPROVAL") return "REVIEW";
  return "APPROVED";
}

function calculateApprovalPriority(params: {
  adaptiveConfidence: number;
  baseStrategyWeight: number;
  autonomousWeight: number;
  autonomousEvolutionScore: number;
  impact: AutonomousEvolutionTradeApprovalImpact;
}) {
  const impactBonus =
    params.impact === "BOOST_APPROVAL"
      ? 12
      : params.impact === "STRICT_APPROVAL"
        ? -10
        : params.impact === "BLOCK_APPROVAL"
          ? -35
          : 0;

  return clamp(
    Math.round(
      params.adaptiveConfidence * 0.35 +
        params.baseStrategyWeight * 0.25 +
        params.autonomousWeight * 0.25 +
        params.autonomousEvolutionScore * 0.15 +
        impactBonus
    ),
    0,
    100
  );
}

function buildReason(params: {
  strategy: string;
  symbol: string;
  impact: AutonomousEvolutionTradeApprovalImpact;
  finalStatus: AutonomousEvolutionTradeApprovalDecision["finalStatus"];
  autonomousWeightStatus: string;
}) {
  return `${params.symbol} ${params.strategy} receives ${params.impact} from Autonomous Evolution. Weight status ${params.autonomousWeightStatus}. Final approval status: ${params.finalStatus}.`;
}

export function generateAutonomousEvolutionTradeApprovalSyncReport():
  AutonomousEvolutionTradeApprovalSyncReport {
  const tradeApproval = buildTradeApprovalEngineReport();
  const autonomousWeights = generateAutonomousEvolutionStrategyWeightSyncReport();
  const evolution = generateAutonomousTradingEvolutionReport();

  const decisions: AutonomousEvolutionTradeApprovalDecision[] =
    tradeApproval.decisions.map((trade) => {
      const autonomousWeight = findAutonomousWeight({
        strategy: trade.strategy,
        symbol: trade.symbol,
        decisions: autonomousWeights.decisions,
      });

      const autonomousRecommendedWeight =
        autonomousWeight?.recommendedWeight ?? trade.strategyWeight;

      const autonomousWeightChange =
        autonomousWeight?.weightChange ?? 0;

      const autonomousWeightStatus =
        autonomousWeight?.status ?? "UNMATCHED";

      const approvalImpact = resolveApprovalImpact({
        baseApproved: trade.approved,
        cycleDecision: evolution.cycleDecision,
        autonomousWeightStatus,
        autonomousWeightChange,
        autonomousEvolutionScore: evolution.autonomousEvolutionScore,
      });

      const positionSizingBias = resolvePositionSizingBias(approvalImpact);

      const finalStatus = resolveFinalStatus({
        impact: approvalImpact,
        baseApproved: trade.approved,
      });

      const finalApproved =
        finalStatus === "APPROVED" && approvalImpact !== "BLOCK_APPROVAL";

      const approvalPriority = calculateApprovalPriority({
        adaptiveConfidence: trade.adaptiveConfidence,
        baseStrategyWeight: trade.strategyWeight,
        autonomousWeight: autonomousRecommendedWeight,
        autonomousEvolutionScore: evolution.autonomousEvolutionScore,
        impact: approvalImpact,
      });

      return {
        id: `autonomous-trade-approval-${trade.symbol.toLowerCase()}-${trade.strategy
          .toLowerCase()
          .replaceAll(" ", "-")}`,
        symbol: trade.symbol,
        strategy: trade.strategy,
        direction: trade.direction,
        baseApproved: trade.approved,
        baseStatus: trade.status,
        baseConfidence: trade.baseConfidence,
        adaptiveConfidence: trade.adaptiveConfidence,
        baseStrategyWeight: trade.strategyWeight,
        autonomousWeight: autonomousRecommendedWeight,
        autonomousWeightStatus,
        autonomousWeightChange,
        approvalImpact,
        approvalPriority,
        positionSizingBias,
        finalApproved,
        finalStatus,
        reason: buildReason({
          strategy: trade.strategy,
          symbol: trade.symbol,
          impact: approvalImpact,
          finalStatus,
          autonomousWeightStatus,
        }),
      };
    });

  const approvedCandidates = decisions.filter(
    (decision) => decision.finalStatus === "APPROVED"
  );

  const reviewCandidates = decisions.filter(
    (decision) => decision.finalStatus === "REVIEW"
  ).length;

  const rejectedCandidates = decisions.filter(
    (decision) => decision.finalStatus === "REJECTED"
  ).length;

  const blockedCandidates = decisions.filter(
    (decision) => decision.finalStatus === "BLOCKED"
  ).length;

  const boostApprovalItems = decisions.filter(
    (decision) => decision.approvalImpact === "BOOST_APPROVAL"
  ).length;

  const strictApprovalItems = decisions.filter(
    (decision) => decision.approvalImpact === "STRICT_APPROVAL"
  ).length;

  const normalApprovalItems = decisions.filter(
    (decision) => decision.approvalImpact === "NORMAL_APPROVAL"
  ).length;

  const blockApprovalItems = decisions.filter(
    (decision) => decision.approvalImpact === "BLOCK_APPROVAL"
  ).length;

  const bestCandidate =
    approvedCandidates.length === 0
      ? null
      : [...approvedCandidates].sort(
          (a, b) => b.approvalPriority - a.approvalPriority
        )[0];

  const recommendation =
    bestCandidate === null
      ? "No final approved trade candidate after Autonomous Evolution approval sync."
      : `${bestCandidate.symbol} ${bestCandidate.strategy} is the strongest autonomous approval candidate with priority ${bestCandidate.approvalPriority}.`;

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    cycleDecision: evolution.cycleDecision,
    autonomousEvolutionScore: evolution.autonomousEvolutionScore,
    totalCandidates: decisions.length,
    approvedCandidates: approvedCandidates.length,
    reviewCandidates,
    rejectedCandidates,
    blockedCandidates,
    boostApprovalItems,
    strictApprovalItems,
    normalApprovalItems,
    blockApprovalItems,
    bestCandidate,
    decisions,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
