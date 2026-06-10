import { generateMultiStyleConsensusReport } from "@/lib/multi-style-consensus";

import {
  ConsensusTradeApprovalDecision,
  ConsensusTradeApprovalGate,
  ConsensusTradeApprovalGateStatus,
  MultiStyleConsensusTradeApprovalSyncReport,
} from "./multi-style-consensus-trade-approval-types";

const VERSION = "V16.1.2" as const;

function resolveGateStatus(params: {
  score: number;
  threshold: number;
  blocked: boolean;
  strict: boolean;
}): ConsensusTradeApprovalGateStatus {
  if (params.blocked) return "BLOCK";
  if (params.score < params.threshold) return "FAIL";
  if (params.strict) return "STRICT_PASS";
  return "PASS";
}

function createGate(params: {
  id: string;
  name: string;
  score: number;
  threshold: number;
  required: boolean;
  reason: string;
  blocked: boolean;
  strict: boolean;
}): ConsensusTradeApprovalGate {
  return {
    id: params.id,
    name: params.name,
    status: resolveGateStatus(params),
    score: params.score,
    threshold: params.threshold,
    required: params.required,
    reason: params.reason,
  };
}

function resolveApprovalStatus(params: {
  consensusStatus: string;
  consensusLevel: string;
  failedRequiredGate: boolean;
}): ConsensusTradeApprovalDecision["approvalStatus"] {
  if (
    params.consensusStatus === "BLOCKED" ||
    params.consensusLevel === "NO_CONSENSUS"
  ) {
    return "BLOCKED";
  }

  if (params.failedRequiredGate) return "REJECTED";

  if (
    params.consensusStatus === "STRICT_APPROVAL_REQUIRED" ||
    params.consensusLevel === "LOW_CONFIDENCE"
  ) {
    return "STRICT_APPROVAL_REQUIRED";
  }

  return "APPROVED";
}

function resolveMinimumConsensusScore(consensusLevel: string) {
  if (consensusLevel === "ELITE_CONFIDENCE") return 80;
  if (consensusLevel === "HIGH_CONFIDENCE") return 70;
  if (consensusLevel === "LOW_CONFIDENCE") return 60;
  return 100;
}

function buildGates(decision: ReturnType<typeof generateMultiStyleConsensusReport>["decisions"][number]) {
  const blocked =
    decision.consensusStatus === "BLOCKED" ||
    decision.consensusLevel === "NO_CONSENSUS" ||
    decision.primaryStyle === "NONE";

  const strict =
    decision.consensusStatus === "STRICT_APPROVAL_REQUIRED" ||
    decision.consensusLevel === "LOW_CONFIDENCE";

  const minimumGoCount =
    decision.consensusLevel === "ELITE_CONFIDENCE"
      ? 3
      : decision.consensusLevel === "HIGH_CONFIDENCE"
        ? 2
        : decision.consensusLevel === "LOW_CONFIDENCE"
          ? 1
          : 1;

  const minimumConsensusScore = resolveMinimumConsensusScore(
    decision.consensusLevel
  );

  return [
    createGate({
      id: `consensus-gate-go-count-${decision.symbol.toLowerCase()}`,
      name: "Multi-Style GO Count Gate",
      score: decision.goCount,
      threshold: minimumGoCount,
      required: true,
      reason:
        "Trade Approval requires enough GO confirmations from SCALPING, DAYTRADING and SWING.",
      blocked,
      strict,
    }),
    createGate({
      id: `consensus-gate-score-${decision.symbol.toLowerCase()}`,
      name: "Consensus Score Gate",
      score: decision.consensusScore,
      threshold: minimumConsensusScore,
      required: true,
      reason:
        "Consensus score must match the confidence level before trade approval.",
      blocked,
      strict,
    }),
    createGate({
      id: `consensus-gate-direction-${decision.symbol.toLowerCase()}`,
      name: "Direction Gate",
      score: decision.activeDirection === "NEUTRAL" ? 0 : 100,
      threshold: 100,
      required: true,
      reason:
        "Active direction must be LONG or SHORT before execution approval.",
      blocked,
      strict,
    }),
    createGate({
      id: `consensus-gate-size-${decision.symbol.toLowerCase()}`,
      name: "Consensus Position Size Gate",
      score: decision.recommendedPositionMultiplier,
      threshold:
        decision.consensusLevel === "LOW_CONFIDENCE"
          ? 0.2
          : decision.consensusLevel === "HIGH_CONFIDENCE"
            ? 0.5
            : decision.consensusLevel === "ELITE_CONFIDENCE"
              ? 0.8
              : 1,
      required: true,
      reason:
        "Position size multiplier must be compatible with consensus confidence.",
      blocked,
      strict,
    }),
  ];
}

function buildDecision(
  decision: ReturnType<typeof generateMultiStyleConsensusReport>["decisions"][number]
): ConsensusTradeApprovalDecision {
  const gates = buildGates(decision);

  const failedRequiredGate = gates.some(
    (gate) =>
      gate.required &&
      (gate.status === "FAIL" || gate.status === "BLOCK")
  );

  const approvalStatus = resolveApprovalStatus({
    consensusStatus: decision.consensusStatus,
    consensusLevel: decision.consensusLevel,
    failedRequiredGate,
  });

  const allowExecution =
    approvalStatus === "APPROVED" ||
    approvalStatus === "STRICT_APPROVAL_REQUIRED";

  const passedGates = gates.filter((gate) => gate.status === "PASS").length;
  const strictPassedGates = gates.filter(
    (gate) => gate.status === "STRICT_PASS"
  ).length;
  const failedGates = gates.filter((gate) => gate.status === "FAIL").length;
  const blockedGates = gates.filter((gate) => gate.status === "BLOCK").length;

  const reason =
    approvalStatus === "BLOCKED"
      ? `${decision.symbol}: Consensus Trade Approval blocked because no valid multi-style consensus exists.`
      : approvalStatus === "REJECTED"
        ? `${decision.symbol}: Consensus Trade Approval rejected because one or more required consensus gates failed.`
        : approvalStatus === "STRICT_APPROVAL_REQUIRED"
          ? `${decision.symbol}: ${decision.consensusLevel} requires strict approval and reduced execution controls.`
          : `${decision.symbol}: ${decision.consensusLevel} approved for consensus-based trade routing.`;

  return {
    id: `multi-style-consensus-trade-approval-${decision.symbol.toLowerCase()}`,
    symbol: decision.symbol,
    primaryStyle: decision.primaryStyle,
    secondaryStyle: decision.secondaryStyle,
    activeDirection: decision.activeDirection,
    goCount: decision.goCount,
    consensusLevel: decision.consensusLevel,
    consensusScore: decision.consensusScore,
    consensusStatus: decision.consensusStatus,
    approvalStatus,
    allowExecution,
    requireStrictApproval: approvalStatus === "STRICT_APPROVAL_REQUIRED",
    approvedStyles: decision.approvedStyles,
    strictApprovalStyles: decision.strictApprovalStyles,
    positionSizeMultiplier: decision.recommendedPositionMultiplier,
    finalPositionSize: allowExecution ? decision.recommendedFinalPositionSize : 0,
    passedGates,
    strictPassedGates,
    failedGates,
    blockedGates,
    gates,
    reason,
  };
}

export function generateMultiStyleConsensusTradeApprovalSyncReport():
  MultiStyleConsensusTradeApprovalSyncReport {
  const consensus = generateMultiStyleConsensusReport();

  const decisions = consensus.decisions.map(buildDecision);

  const approvedSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "APPROVED"
  ).length;

  const strictApprovalSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "STRICT_APPROVAL_REQUIRED"
  ).length;

  const rejectedSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "REJECTED"
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "BLOCKED"
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
      ? "Elite consensus approvals detected. Route only after full broker and risk validation."
      : highConfidenceSymbols > 0
        ? "High consensus approvals detected. Route approved symbols to Unified Decision and Broker Selection."
        : strictApprovalSymbols > 0
          ? "Low consensus or strict approval detected. Route only with reduced size and strict validation."
          : "No consensus approval available. Keep execution blocked.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    approvedSymbols,
    strictApprovalSymbols,
    rejectedSymbols,
    blockedSymbols,
    lowConfidenceSymbols,
    highConfidenceSymbols,
    eliteConfidenceSymbols,
    decisions,
    systemRule:
      "Multi-Style Consensus Trade Approval validates 1-GO, 2-GO and 3-GO consensus before routing trades forward. Existing primaryStyle and secondaryStyle remain intact.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
