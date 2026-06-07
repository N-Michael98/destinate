import type {
  StyleUnifiedDecision,
  TradingStylePriorityInput,
  TradingStylePriorityUnifiedDecisionSyncReport,
  UnifiedDecisionMode,
} from "./trading-style-priority-unified-decision-types";

const priorityInputs: TradingStylePriorityInput[] = [
  {
    symbol: "XAUUSD",
    primaryStyle: "SCALPING",
    secondaryStyle: "NONE",
    activeDirection: "LONG",
    activePriorityScore: 88.05,
    activePositionSizeMultiplier: 0.35,
    activeFinalPositionSize: 350,
    requiresStrictApproval: true,
    tradeAllowed: true,
    blockedStyles: ["SWING", "DAYTRADING"],
    waitingStyles: ["DAYTRADING", "SWING"],
    rejectedStyles: [],
  },
  {
    symbol: "NAS100",
    primaryStyle: "SWING",
    secondaryStyle: "SCALPING",
    activeDirection: "LONG",
    activePriorityScore: 100,
    activePositionSizeMultiplier: 0.8,
    activeFinalPositionSize: 960,
    requiresStrictApproval: false,
    tradeAllowed: true,
    blockedStyles: ["DAYTRADING"],
    waitingStyles: ["DAYTRADING"],
    rejectedStyles: [],
  },
  {
    symbol: "SPX500",
    primaryStyle: "NONE",
    secondaryStyle: "NONE",
    activeDirection: "NEUTRAL",
    activePriorityScore: 0,
    activePositionSizeMultiplier: 0,
    activeFinalPositionSize: 0,
    requiresStrictApproval: false,
    tradeAllowed: false,
    blockedStyles: ["SWING", "SCALPING", "DAYTRADING"],
    waitingStyles: ["SWING", "SCALPING"],
    rejectedStyles: ["DAYTRADING"],
  },
];

function resolveUnifiedDecisionMode(
  input: TradingStylePriorityInput,
): UnifiedDecisionMode {
  if (!input.tradeAllowed || input.primaryStyle === "NONE") return "STYLE_BLOCKED";

  if (input.requiresStrictApproval) return "STYLE_STRICT_APPROVAL";

  if (input.activePriorityScore < 55) return "STYLE_WAIT";

  return "STYLE_APPROVED";
}

function resolvePortfolioBrainRoute(
  input: TradingStylePriorityInput,
): StyleUnifiedDecision["portfolioBrainRoute"] {
  if (input.primaryStyle === "SCALPING") return "SCALP_ROUTE";
  if (input.primaryStyle === "DAYTRADING") return "DAYTRADE_ROUTE";
  if (input.primaryStyle === "SWING") return "SWING_ROUTE";
  return "NO_TRADE_ROUTE";
}

function resolveApprovalStrictness(
  mode: UnifiedDecisionMode,
): StyleUnifiedDecision["approvalStrictness"] {
  if (mode === "STYLE_BLOCKED") return "BLOCKED";
  if (mode === "STYLE_STRICT_APPROVAL") return "HIGH";
  return "NORMAL";
}

function buildDecision(input: TradingStylePriorityInput): StyleUnifiedDecision {
  const unifiedDecisionMode = resolveUnifiedDecisionMode(input);
  const portfolioBrainRoute = resolvePortfolioBrainRoute(input);
  const approvalStrictness = resolveApprovalStrictness(unifiedDecisionMode);

  const executionAllowed =
    unifiedDecisionMode === "STYLE_APPROVED" ||
    unifiedDecisionMode === "STYLE_STRICT_APPROVAL";

  const reason =
    unifiedDecisionMode === "STYLE_BLOCKED"
      ? `${input.symbol}: No primary trading style is active. Unified Decision must block execution.`
      : unifiedDecisionMode === "STYLE_STRICT_APPROVAL"
        ? `${input.symbol}: ${input.primaryStyle} route is active but requires strict approval and reduced size.`
        : unifiedDecisionMode === "STYLE_WAIT"
          ? `${input.symbol}: Primary style exists but priority score is too low. Unified Decision should wait.`
          : `${input.symbol}: ${input.primaryStyle} route is approved for Unified Decision.`;

  return {
    id: `style-priority-unified-${input.symbol.toLowerCase()}`,
    symbol: input.symbol,
    unifiedDecisionMode,
    primaryStyle: input.primaryStyle,
    secondaryStyle: input.secondaryStyle,
    activeDirection: input.activeDirection,
    tradeAllowed: input.tradeAllowed,
    executionAllowed,
    requiresStrictApproval: input.requiresStrictApproval,
    portfolioBrainRoute,
    approvalStrictness,
    positionSizeMultiplier: input.activePositionSizeMultiplier,
    finalPositionSize: input.activeFinalPositionSize,
    priorityScore: input.activePriorityScore,
    blockedStyles: input.blockedStyles,
    waitingStyles: input.waitingStyles,
    rejectedStyles: input.rejectedStyles,
    reason,
  };
}

export function getTradingStylePriorityUnifiedDecisionSyncReport(): TradingStylePriorityUnifiedDecisionSyncReport {
  const decisions = priorityInputs.map(buildDecision);

  const styleApprovedSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "STYLE_APPROVED",
  ).length;

  const strictApprovalSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "STYLE_STRICT_APPROVAL",
  ).length;

  const blockedSymbols = decisions.filter(
    (decision) => decision.unifiedDecisionMode === "STYLE_BLOCKED",
  ).length;

  const scalpRouteSymbols = decisions.filter(
    (decision) => decision.portfolioBrainRoute === "SCALP_ROUTE",
  ).length;

  const daytradeRouteSymbols = decisions.filter(
    (decision) => decision.portfolioBrainRoute === "DAYTRADE_ROUTE",
  ).length;

  const swingRouteSymbols = decisions.filter(
    (decision) => decision.portfolioBrainRoute === "SWING_ROUTE",
  ).length;

  const recommendation =
    strictApprovalSymbols > 0
      ? "At least one primary style requires strict approval. Portfolio Brain should route style-specific trades with reduced size and strict validation."
      : styleApprovedSymbols > 0
        ? "Primary trading styles are approved. Route style-specific decisions to Trade Approval and Execution Queue."
        : "No primary style is active. Keep execution blocked.";

  return {
    version: "V11.9.7",
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    styleApprovedSymbols,
    strictApprovalSymbols,
    blockedSymbols,
    scalpRouteSymbols,
    daytradeRouteSymbols,
    swingRouteSymbols,
    decisions,
    integrationTarget: [
      "Portfolio Brain Unified Decision",
      "Trade Approval Engine",
      "Execution Queue",
      "Position Sizing",
      "Broker Execution Layer",
    ],
    systemRule:
      "Trading Style Priority must be routed into Unified Decision before execution. Only the active primary style should be sent forward by default. Secondary styles remain visible for context.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
