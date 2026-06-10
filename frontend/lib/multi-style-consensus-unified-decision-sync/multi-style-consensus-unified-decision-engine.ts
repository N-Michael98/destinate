import { generateMultiStyleConsensusTradeApprovalSyncReport } from "@/lib/multi-style-consensus-trade-approval-sync";

import {
  ConsensusPortfolioBrainRoute,
  ConsensusUnifiedDecision,
  ConsensusUnifiedDecisionMode,
  MultiStyleConsensusUnifiedDecisionSyncReport,
} from "./multi-style-consensus-unified-decision-types";

const VERSION = "V16.1.3" as const;

function resolveUnifiedDecisionMode(params: {
  approvalStatus: string;
  consensusLevel: string;
  goCount: number;
}): ConsensusUnifiedDecisionMode {
  if (params.approvalStatus === "BLOCKED") return "CONSENSUS_BLOCKED";
  if (params.approvalStatus === "REJECTED") return "CONSENSUS_WAIT";

  if (params.consensusLevel === "ELITE_CONFIDENCE" && params.goCount >= 3) {
    return "CONSENSUS_ELITE";
  }

  if (params.consensusLevel === "HIGH_CONFIDENCE" && params.goCount >= 2) {
    return "CONSENSUS_APPROVED";
  }

  if (
    params.consensusLevel === "LOW_CONFIDENCE" ||
    params.approvalStatus === "STRICT_APPROVAL_REQUIRED"
  ) {
    return "CONSENSUS_STRICT";
  }

  return "CONSENSUS_WAIT";
}

function resolvePortfolioBrainRoute(params: {
  primaryStyle: string;
  goCount: number;
}): ConsensusPortfolioBrainRoute {
  if (params.goCount >= 2) return "CONSENSUS_MULTI_STYLE_ROUTE";
  if (params.primaryStyle === "SCALPING") return "CONSENSUS_SCALP_ROUTE";
  if (params.primaryStyle === "DAYTRADING") return "CONSENSUS_DAYTRADE_ROUTE";
  if (params.primaryStyle === "SWING") return "CONSENSUS_SWING_ROUTE";

  return "NO_TRADE_ROUTE";
}

function resolveBrokerRoutingMode(params: {
  mode: ConsensusUnifiedDecisionMode;
  goCount: number;
}): ConsensusUnifiedDecision["brokerRoutingMode"] {
  if (
    params.mode === "CONSENSUS_BLOCKED" ||
    params.mode === "CONSENSUS_WAIT"
  ) {
    return "NO_BROKER_ROUTE";
  }

  if (params.goCount >= 2) return "DUAL_BROKER_CHECK";

  return "SINGLE_BROKER_CHECK";
}

function resolveApprovalStrictness(
  mode: ConsensusUnifiedDecisionMode
): ConsensusUnifiedDecision["approvalStrictness"] {
  if (mode === "CONSENSUS_BLOCKED") return "BLOCKED";
  if (mode === "CONSENSUS_ELITE") return "ELITE_VALIDATION";
  if (mode === "CONSENSUS_STRICT") return "HIGH";
  return "NORMAL";
}

function calculateExecutionPriority(params: {
  consensusScore: number;
  goCount: number;
  mode: ConsensusUnifiedDecisionMode;
}) {
  const modeBonus =
    params.mode === "CONSENSUS_ELITE"
      ? 15
      : params.mode === "CONSENSUS_APPROVED"
        ? 8
        : params.mode === "CONSENSUS_STRICT"
          ? -6
          : params.mode === "CONSENSUS_WAIT"
            ? -20
            : -50;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(params.consensusScore * 0.75 + params.goCount * 6 + modeBonus)
    )
  );
}

function buildReason(params: {
  symbol: string;
  mode: ConsensusUnifiedDecisionMode;
  consensusLevel: string;
  goCount: number;
  route: ConsensusPortfolioBrainRoute;
}) {
  if (params.mode === "CONSENSUS_BLOCKED") {
    return `${params.symbol}: Unified Decision blocks execution because no valid consensus approval exists.`;
  }

  if (params.mode === "CONSENSUS_WAIT") {
    return `${params.symbol}: Unified Decision waits because consensus gates did not produce a tradable decision.`;
  }

  return `${params.symbol}: Unified Decision mode ${params.mode} from ${params.goCount} GO confirmation(s), consensus ${params.consensusLevel}, route ${params.route}.`;
}

export function generateMultiStyleConsensusUnifiedDecisionSyncReport():
  MultiStyleConsensusUnifiedDecisionSyncReport {
  const tradeApproval = generateMultiStyleConsensusTradeApprovalSyncReport();

  const decisions: ConsensusUnifiedDecision[] = tradeApproval.decisions.map(
    (decision) => {
      const unifiedDecisionMode = resolveUnifiedDecisionMode({
        approvalStatus: decision.approvalStatus,
        consensusLevel: decision.consensusLevel,
        goCount: decision.goCount,
      });

      const portfolioBrainRoute = resolvePortfolioBrainRoute({
        primaryStyle: decision.primaryStyle,
        goCount: decision.goCount,
      });

      const brokerRoutingMode = resolveBrokerRoutingMode({
        mode: unifiedDecisionMode,
        goCount: decision.goCount,
      });

      const approvalStrictness = resolveApprovalStrictness(unifiedDecisionMode);

      const executionPriority = calculateExecutionPriority({
        consensusScore: decision.consensusScore,
        goCount: decision.goCount,
        mode: unifiedDecisionMode,
      });

      const executionAllowed =
        unifiedDecisionMode === "CONSENSUS_ELITE" ||
        unifiedDecisionMode === "CONSENSUS_APPROVED" ||
        unifiedDecisionMode === "CONSENSUS_STRICT";

      return {
        id: `multi-style-consensus-unified-${decision.symbol.toLowerCase()}`,
        symbol: decision.symbol,
        unifiedDecisionMode,
        primaryStyle: decision.primaryStyle,
        secondaryStyle: decision.secondaryStyle,
        activeDirection: decision.activeDirection,
        goCount: decision.goCount,
        consensusLevel: decision.consensusLevel,
        consensusScore: decision.consensusScore,
        approvalStatus: decision.approvalStatus,
        executionAllowed,
        requiresStrictApproval:
          decision.requireStrictApproval ||
          unifiedDecisionMode === "CONSENSUS_STRICT",
        portfolioBrainRoute,
        brokerRoutingMode,
        executionPriority,
        approvalStrictness,
        positionSizeMultiplier: decision.positionSizeMultiplier,
        finalPositionSize: executionAllowed ? decision.finalPositionSize : 0,
        approvedStyles: decision.approvedStyles,
        strictApprovalStyles: decision.strictApprovalStyles,
        reason: buildReason({
          symbol: decision.symbol,
          mode: unifiedDecisionMode,
          consensusLevel: decision.consensusLevel,
          goCount: decision.goCount,
          route: portfolioBrainRoute,
        }),
      };
    }
  );

  const eliteSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "CONSENSUS_ELITE"
  ).length;

  const approvedSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "CONSENSUS_APPROVED"
  ).length;

  const strictSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "CONSENSUS_STRICT"
  ).length;

  const waitingSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "CONSENSUS_WAIT"
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "CONSENSUS_BLOCKED"
  ).length;

  const dualBrokerCheckSymbols = decisions.filter(
    (decision) => decision.brokerRoutingMode === "DUAL_BROKER_CHECK"
  ).length;

  const singleBrokerCheckSymbols = decisions.filter(
    (decision) => decision.brokerRoutingMode === "SINGLE_BROKER_CHECK"
  ).length;

  const recommendation =
    eliteSymbols > 0
      ? "Elite consensus detected. Route through Portfolio Brain, full risk validation and dual broker check."
      : approvedSymbols > 0
        ? "Approved multi-style consensus detected. Route to Portfolio Brain and dual broker check."
        : strictSymbols > 0
          ? "Strict consensus detected. Route only with reduced size and strict broker validation."
          : "No approved consensus unified decision. Keep execution blocked.";

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    eliteSymbols,
    approvedSymbols,
    strictSymbols,
    waitingSymbols,
    blockedSymbols,
    dualBrokerCheckSymbols,
    singleBrokerCheckSymbols,
    decisions,
    integrationTarget: [
      "Portfolio Brain Unified Decision",
      "Broker Selection",
      "Dual Broker Orchestrator",
      "Execution Queue",
      "Position Sizing",
    ],
    systemRule:
      "Multi-Style Consensus Unified Decision converts consensus trade approval into final routing modes while keeping legacy V11.x unified decision modules unchanged.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
