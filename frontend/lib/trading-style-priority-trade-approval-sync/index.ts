import type {
  StyleApprovalGateStatus,
  StylePriorityTradeApprovalDecision,
  StylePriorityTradeApprovalInput,
  StylePriorityTradeApprovalSyncReport,
  StyleTradeApprovalGate,
} from "./trading-style-priority-trade-approval-types";

const stylePriorityInputs: StylePriorityTradeApprovalInput[] = [
  {
    symbol: "XAUUSD",
    primaryStyle: "SCALPING",
    secondaryStyle: "NONE",
    activeDirection: "LONG",
    unifiedDecisionMode: "STYLE_STRICT_APPROVAL",
    portfolioBrainRoute: "SCALP_ROUTE",
    priorityScore: 88.05,
    positionSizeMultiplier: 0.35,
    finalPositionSize: 350,
    requiresStrictApproval: true,
    executionAllowed: true,
    approvalStrictness: "HIGH",
  },
  {
    symbol: "NAS100",
    primaryStyle: "SWING",
    secondaryStyle: "SCALPING",
    activeDirection: "LONG",
    unifiedDecisionMode: "STYLE_APPROVED",
    portfolioBrainRoute: "SWING_ROUTE",
    priorityScore: 100,
    positionSizeMultiplier: 0.8,
    finalPositionSize: 960,
    requiresStrictApproval: false,
    executionAllowed: true,
    approvalStrictness: "NORMAL",
  },
  {
    symbol: "SPX500",
    primaryStyle: "NONE",
    secondaryStyle: "NONE",
    activeDirection: "NEUTRAL",
    unifiedDecisionMode: "STYLE_BLOCKED",
    portfolioBrainRoute: "NO_TRADE_ROUTE",
    priorityScore: 0,
    positionSizeMultiplier: 0,
    finalPositionSize: 0,
    requiresStrictApproval: false,
    executionAllowed: false,
    approvalStrictness: "BLOCKED",
  },
];

function resolveGateStatus(
  score: number,
  threshold: number,
  blocked: boolean,
  strict: boolean,
): StyleApprovalGateStatus {
  if (blocked) return "BLOCK";
  if (score < threshold) return "FAIL";
  if (strict) return "STRICT_PASS";
  return "PASS";
}

function createGate(
  id: string,
  name: string,
  score: number,
  threshold: number,
  required: boolean,
  reason: string,
  blocked: boolean,
  strict: boolean,
): StyleTradeApprovalGate {
  return {
    id,
    name,
    status: resolveGateStatus(score, threshold, blocked, strict),
    score,
    threshold,
    required,
    reason,
  };
}

function buildGates(input: StylePriorityTradeApprovalInput): StyleTradeApprovalGate[] {
  const blocked =
    !input.executionAllowed ||
    input.primaryStyle === "NONE" ||
    input.approvalStrictness === "BLOCKED";

  const strict = input.requiresStrictApproval || input.approvalStrictness === "HIGH";

  const minimumPriority = input.primaryStyle === "SCALPING" ? 75 : 65;
  const minimumSize = input.primaryStyle === "SCALPING" ? 0.2 : 0.5;

  return [
    createGate(
      `style-gate-route-${input.symbol.toLowerCase()}`,
      "Portfolio Brain Route Gate",
      input.portfolioBrainRoute === "NO_TRADE_ROUTE" ? 0 : 100,
      100,
      true,
      "Portfolio Brain must provide a valid style route before Trade Approval.",
      blocked,
      strict,
    ),
    createGate(
      `style-gate-priority-${input.symbol.toLowerCase()}`,
      "Style Priority Score Gate",
      input.priorityScore,
      minimumPriority,
      true,
      "Active style priority score must be high enough for approval.",
      blocked,
      strict,
    ),
    createGate(
      `style-gate-size-${input.symbol.toLowerCase()}`,
      "Style Position Size Gate",
      input.positionSizeMultiplier,
      minimumSize,
      true,
      "Position size multiplier must match the active trading style.",
      blocked,
      strict,
    ),
    createGate(
      `style-gate-direction-${input.symbol.toLowerCase()}`,
      "Direction Gate",
      input.activeDirection === "NEUTRAL" ? 0 : 100,
      100,
      true,
      "Active style must have LONG or SHORT direction before execution.",
      blocked,
      strict,
    ),
    createGate(
      `style-gate-execution-${input.symbol.toLowerCase()}`,
      "Execution Permission Gate",
      input.executionAllowed ? 100 : 0,
      100,
      true,
      "Unified Decision must allow execution before Trade Approval can pass.",
      blocked,
      strict,
    ),
  ];
}

function resolveApprovalStatus(
  input: StylePriorityTradeApprovalInput,
  gates: StyleTradeApprovalGate[],
): StylePriorityTradeApprovalDecision["approvalStatus"] {
  if (
    input.primaryStyle === "NONE" ||
    input.approvalStrictness === "BLOCKED" ||
    !input.executionAllowed
  ) {
    return "BLOCKED";
  }

  const hasFailedRequiredGate = gates.some(
    (gate) =>
      gate.required &&
      (gate.status === "FAIL" || gate.status === "BLOCK"),
  );

  if (hasFailedRequiredGate) return "REJECTED";

  if (input.requiresStrictApproval || input.approvalStrictness === "HIGH") {
    return "STRICT_APPROVAL_REQUIRED";
  }

  return "APPROVED";
}

function buildDecision(
  input: StylePriorityTradeApprovalInput,
): StylePriorityTradeApprovalDecision {
  const gates = buildGates(input);
  const approvalStatus = resolveApprovalStatus(input, gates);

  const passedGates = gates.filter((gate) => gate.status === "PASS").length;
  const strictPassedGates = gates.filter(
    (gate) => gate.status === "STRICT_PASS",
  ).length;
  const failedGates = gates.filter((gate) => gate.status === "FAIL").length;
  const blockedGates = gates.filter((gate) => gate.status === "BLOCK").length;

  const allowExecution =
    approvalStatus === "APPROVED" ||
    approvalStatus === "STRICT_APPROVAL_REQUIRED";

  const reason =
    approvalStatus === "BLOCKED"
      ? `${input.symbol}: Trade Approval blocked because no active executable primary style exists.`
      : approvalStatus === "REJECTED"
        ? `${input.symbol}: Trade Approval rejected because one or more required style gates failed.`
        : approvalStatus === "STRICT_APPROVAL_REQUIRED"
          ? `${input.symbol}: ${input.primaryStyle} approved only with strict approval and reduced execution controls.`
          : `${input.symbol}: ${input.primaryStyle} approved for style-specific execution.`;

  return {
    id: `style-priority-trade-approval-${input.symbol.toLowerCase()}`,
    symbol: input.symbol,
    primaryStyle: input.primaryStyle,
    secondaryStyle: input.secondaryStyle,
    activeDirection: input.activeDirection,
    approvalStatus,
    allowExecution,
    requireStrictApproval: approvalStatus === "STRICT_APPROVAL_REQUIRED",
    portfolioBrainRoute: input.portfolioBrainRoute,
    positionSizeMultiplier: input.positionSizeMultiplier,
    finalPositionSize: allowExecution ? input.finalPositionSize : 0,
    passedGates,
    strictPassedGates,
    failedGates,
    blockedGates,
    gates,
    reason,
  };
}

export function getTradingStylePriorityTradeApprovalSyncReport(): TradingStylePriorityTradeApprovalSyncReport {
  const decisions = stylePriorityInputs.map(buildDecision);

  const approvedSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "APPROVED",
  ).length;

  const strictApprovalSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "STRICT_APPROVAL_REQUIRED",
  ).length;

  const rejectedSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "REJECTED",
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.approvalStatus === "BLOCKED",
  ).length;

  const recommendation =
    strictApprovalSymbols > 0
      ? "Some style-priority decisions require strict approval. Route only approved primary styles forward with reduced size and style-specific controls."
      : approvedSymbols > 0
        ? "Style-priority Trade Approval has approved symbols. Route them to Execution Queue."
        : "No style-priority decisions are approved. Keep execution blocked.";

  return {
    version: "V11.9.8",
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    approvedSymbols,
    strictApprovalSymbols,
    rejectedSymbols,
    blockedSymbols,
    decisions,
    systemRule:
      "Trade Approval validates the active primary trading style from Trading Style Priority. Secondary styles remain context only unless Portfolio Brain explicitly promotes them.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
