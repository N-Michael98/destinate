import type {
  ApprovalGateStatus,
  TradeApprovalGate,
  UnifiedDecisionTradeApprovalInput,
  UnifiedDecisionTradeApprovalSyncReport,
} from "./unified-decision-trade-approval-types";

const unifiedDecisionInput: UnifiedDecisionTradeApprovalInput = {
  finalDecisionMode: "DEFENSIVE",
  finalConfidenceScore: 86,
  finalRiskScore: 100,
  finalStrategyScore: 70,
  tradingAllowed: true,
  aggressiveTradingAllowed: false,
  normalTradingAllowed: false,
  defensiveTradingRequired: true,
  positionSizeMultiplier: 0.35,
  approvalStrictness: "HIGH",
  actions: [
    "ALLOW_ONLY_STRONG_SETUPS",
    "BLOCK_AGGRESSIVE_TRADING",
    "REQUIRE_STRICT_APPROVAL",
    "REDUCE_EXPOSURE",
    "REDUCE_POSITION_SIZE",
  ],
};

function resolveGateStatus(
  score: number,
  threshold: number,
  strictMode: boolean,
): ApprovalGateStatus {
  if (score < threshold) return "BLOCK";
  if (strictMode) return "STRICT_PASS";
  return "PASS";
}

function createGate(
  id: string,
  name: string,
  score: number,
  threshold: number,
  required: boolean,
  reason: string,
  strictMode: boolean,
): TradeApprovalGate {
  return {
    id,
    name,
    status: resolveGateStatus(score, threshold, strictMode),
    required,
    score,
    threshold,
    reason,
  };
}

function buildTradeApprovalGates(
  input: UnifiedDecisionTradeApprovalInput,
): TradeApprovalGate[] {
  const strictMode =
    input.approvalStrictness === "HIGH" ||
    input.approvalStrictness === "EXTREME" ||
    input.defensiveTradingRequired;

  if (!input.tradingAllowed || input.finalDecisionMode === "BLOCKED") {
    return [
      {
        id: "gate-trading-allowed",
        name: "Trading Allowed Gate",
        status: "BLOCK",
        required: true,
        score: 0,
        threshold: 1,
        reason: "Unified Portfolio Brain does not allow trading.",
      },
    ];
  }

  return [
    createGate(
      "gate-confidence",
      "Confidence Gate",
      input.finalConfidenceScore,
      strictMode ? 75 : 60,
      true,
      "Final confidence must be high enough for Trade Approval.",
      strictMode,
    ),
    createGate(
      "gate-risk",
      "Risk Gate",
      100 - input.finalRiskScore,
      strictMode ? 20 : 10,
      true,
      "Risk must remain acceptable. In defensive mode, this gate is stricter.",
      strictMode,
    ),
    createGate(
      "gate-strategy",
      "Strategy Gate",
      input.finalStrategyScore,
      strictMode ? 65 : 55,
      true,
      "Final strategy score must confirm the setup.",
      strictMode,
    ),
    createGate(
      "gate-position-size",
      "Position Size Gate",
      input.positionSizeMultiplier * 100,
      strictMode ? 25 : 50,
      true,
      "Position size multiplier must match risk mode.",
      strictMode,
    ),
    createGate(
      "gate-aggressive-block",
      "Aggressive Trading Block Gate",
      input.aggressiveTradingAllowed ? 0 : 100,
      100,
      true,
      "Aggressive trading must be blocked during defensive mode.",
      strictMode,
    ),
  ];
}

function resolveFinalTradeApprovalStatus(
  gates: TradeApprovalGate[],
): "APPROVED" | "STRICT_APPROVAL_REQUIRED" | "REJECTED" {
  const hasBlockedRequiredGate = gates.some(
    (gate) => gate.required && gate.status === "BLOCK",
  );

  if (hasBlockedRequiredGate) return "REJECTED";

  const hasStrictGate = gates.some((gate) => gate.status === "STRICT_PASS");

  if (hasStrictGate) return "STRICT_APPROVAL_REQUIRED";

  return "APPROVED";
}

export function getUnifiedDecisionTradeApprovalSyncReport(): UnifiedDecisionTradeApprovalSyncReport {
  const gates = buildTradeApprovalGates(unifiedDecisionInput);

  const passedGates = gates.filter((gate) => gate.status === "PASS").length;
  const strictPassedGates = gates.filter(
    (gate) => gate.status === "STRICT_PASS",
  ).length;
  const blockedGates = gates.filter((gate) => gate.status === "BLOCK").length;

  const finalTradeApprovalStatus = resolveFinalTradeApprovalStatus(gates);

  const allowTradeExecution = finalTradeApprovalStatus !== "REJECTED";
  const requireManualReview =
    finalTradeApprovalStatus === "STRICT_APPROVAL_REQUIRED" ||
    unifiedDecisionInput.approvalStrictness === "EXTREME";

  const recommendation =
    finalTradeApprovalStatus === "REJECTED"
      ? "Trade Approval rejects execution. Wait for lower risk or stronger strategy confirmation."
      : finalTradeApprovalStatus === "STRICT_APPROVAL_REQUIRED"
        ? "Trade Approval allows only strict defensive execution with reduced position size and stronger confirmation."
        : "Trade Approval allows normal execution.";

  return {
    version: "V11.8.6",
    status: "READY",
    mode: "SIMULATION",
    input: unifiedDecisionInput,
    gates,
    passedGates,
    strictPassedGates,
    blockedGates,
    finalTradeApprovalStatus,
    allowTradeExecution,
    requireManualReview,
    positionSizeMultiplier: unifiedDecisionInput.positionSizeMultiplier,
    approvalStrictness: unifiedDecisionInput.approvalStrictness,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
