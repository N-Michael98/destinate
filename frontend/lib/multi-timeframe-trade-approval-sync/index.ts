import type {
  MultiTimeframeTradeApprovalDecision,
  MultiTimeframeTradeApprovalSyncReport,
  MultiTimeframeTradeRequest,
  MultiTimeframeUnifiedDecision,
  TradeApprovalStatus,
} from "./multi-timeframe-trade-approval-types";

const unifiedDecisions: MultiTimeframeUnifiedDecision[] = [
  {
    symbol: "XAUUSD",
    preferredStyle: "SCALPING",
    allowedStyles: ["SCALPING"],
    waitingStyles: ["SWING", "DAYTRADING"],
    blockedStyles: [],
    finalDirection: "LONG",
    finalConfidenceScore: 76,
    finalRiskScore: 21,
    finalPositionSizeMultiplier: 0.35,
    tradeAllowed: true,
    requiresStrictApproval: true,
    scalpOnlyMode: true,
  },
  {
    symbol: "NAS100",
    preferredStyle: "SWING",
    allowedStyles: ["SWING", "SCALPING"],
    waitingStyles: ["DAYTRADING"],
    blockedStyles: [],
    finalDirection: "LONG",
    finalConfidenceScore: 72,
    finalRiskScore: 29,
    finalPositionSizeMultiplier: 0.8,
    tradeAllowed: true,
    requiresStrictApproval: false,
    scalpOnlyMode: false,
  },
  {
    symbol: "SPX500",
    preferredStyle: "NONE",
    allowedStyles: [],
    waitingStyles: ["SWING", "DAYTRADING", "SCALPING"],
    blockedStyles: [],
    finalDirection: "NEUTRAL",
    finalConfidenceScore: 0,
    finalRiskScore: 0,
    finalPositionSizeMultiplier: 0,
    tradeAllowed: false,
    requiresStrictApproval: false,
    scalpOnlyMode: false,
  },
];

const tradeRequests: MultiTimeframeTradeRequest[] = [
  {
    id: "request-xauusd-scalping-long",
    symbol: "XAUUSD",
    requestedStyle: "SCALPING",
    requestedDirection: "LONG",
    requestedPositionSize: 1000,
  },
  {
    id: "request-xauusd-swing-short",
    symbol: "XAUUSD",
    requestedStyle: "SWING",
    requestedDirection: "SHORT",
    requestedPositionSize: 1000,
  },
  {
    id: "request-nas100-swing-long",
    symbol: "NAS100",
    requestedStyle: "SWING",
    requestedDirection: "LONG",
    requestedPositionSize: 1200,
  },
  {
    id: "request-nas100-scalping-short",
    symbol: "NAS100",
    requestedStyle: "SCALPING",
    requestedDirection: "SHORT",
    requestedPositionSize: 600,
  },
  {
    id: "request-spx500-daytrading-long",
    symbol: "SPX500",
    requestedStyle: "DAYTRADING",
    requestedDirection: "LONG",
    requestedPositionSize: 900,
  },
];

function findUnifiedDecision(symbol: string) {
  return unifiedDecisions.find((decision) => decision.symbol === symbol);
}

function resolveApprovalStatus(
  request: MultiTimeframeTradeRequest,
  decision: MultiTimeframeUnifiedDecision | undefined,
): TradeApprovalStatus {
  if (!decision || !decision.tradeAllowed) return "REJECTED";

  if (decision.blockedStyles.includes(request.requestedStyle)) return "REJECTED";

  if (decision.waitingStyles.includes(request.requestedStyle)) return "WAIT";

  if (!decision.allowedStyles.includes(request.requestedStyle)) return "REJECTED";

  if (decision.finalDirection !== "NEUTRAL" && request.requestedDirection !== decision.finalDirection) {
    if (request.requestedStyle === "SCALPING" && decision.allowedStyles.includes("SCALPING")) {
      return decision.requiresStrictApproval ? "STRICT_APPROVAL_REQUIRED" : "APPROVED";
    }

    return "REJECTED";
  }

  if (decision.requiresStrictApproval) return "STRICT_APPROVAL_REQUIRED";

  return "APPROVED";
}

function createApprovalDecision(
  request: MultiTimeframeTradeRequest,
): MultiTimeframeTradeApprovalDecision {
  const unifiedDecision = findUnifiedDecision(request.symbol);
  const approvalStatus = resolveApprovalStatus(request, unifiedDecision);

  const allowExecution =
    approvalStatus === "APPROVED" || approvalStatus === "STRICT_APPROVAL_REQUIRED";

  const positionSizeMultiplier = allowExecution
    ? unifiedDecision?.finalPositionSizeMultiplier ?? 0
    : 0;

  const finalPositionSize = Number(
    (request.requestedPositionSize * positionSizeMultiplier).toFixed(2),
  );

  const approvedStyle = unifiedDecision?.preferredStyle ?? "NONE";
  const approvedDirection = unifiedDecision?.finalDirection ?? "NEUTRAL";

  const reason =
    !unifiedDecision
      ? `${request.symbol}: No multi-timeframe decision found. Trade rejected.`
      : approvalStatus === "APPROVED"
        ? `${request.symbol}: ${request.requestedStyle} ${request.requestedDirection} approved by multi-timeframe Trade Approval.`
        : approvalStatus === "STRICT_APPROVAL_REQUIRED"
          ? `${request.symbol}: ${request.requestedStyle} ${request.requestedDirection} allowed only with strict approval and reduced size.`
          : approvalStatus === "WAIT"
            ? `${request.symbol}: ${request.requestedStyle} is waiting for confirmation and cannot be executed yet.`
            : `${request.symbol}: ${request.requestedStyle} ${request.requestedDirection} rejected by multi-timeframe style rules.`;

  return {
    id: `mtf-approval-${request.id}`,
    symbol: request.symbol,
    requestedStyle: request.requestedStyle,
    requestedDirection: request.requestedDirection,
    requestedPositionSize: request.requestedPositionSize,
    approvedStyle,
    approvedDirection,
    approvalStatus,
    allowExecution,
    finalPositionSize,
    positionSizeMultiplier,
    confidenceScore: unifiedDecision?.finalConfidenceScore ?? 0,
    riskScore: unifiedDecision?.finalRiskScore ?? 0,
    requiresStrictApproval: approvalStatus === "STRICT_APPROVAL_REQUIRED",
    reason,
  };
}

export function getMultiTimeframeTradeApprovalSyncReport(): MultiTimeframeTradeApprovalSyncReport {
  const decisions = tradeRequests.map(createApprovalDecision);

  const approvedTrades = decisions.filter(
    (decision) => decision.approvalStatus === "APPROVED",
  ).length;

  const strictApprovalTrades = decisions.filter(
    (decision) => decision.approvalStatus === "STRICT_APPROVAL_REQUIRED",
  ).length;

  const rejectedTrades = decisions.filter(
    (decision) => decision.approvalStatus === "REJECTED",
  ).length;

  const waitingTrades = decisions.filter(
    (decision) => decision.approvalStatus === "WAIT",
  ).length;

  const recommendation =
    strictApprovalTrades > 0
      ? "Some multi-timeframe trades are allowed only under strict approval. Route them with reduced position size and style-specific execution rules."
      : approvedTrades > 0
        ? "Multi-timeframe Trade Approval found approved trades. Route them to Execution Queue."
        : "No multi-timeframe trade is approved. Wait for clearer style confirmation.";

  return {
    version: "V11.9.3",
    status: "READY",
    mode: "SIMULATION",
    totalTradeRequests: decisions.length,
    approvedTrades,
    strictApprovalTrades,
    rejectedTrades,
    waitingTrades,
    decisions,
    systemRule:
      "Trade Approval must validate the requested trading style separately. A symbol can reject swing/daytrading while still allowing scalping with reduced size and strict approval.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
