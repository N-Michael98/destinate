import type {
  PortfolioBrainUnifiedDecisionReport,
  UnifiedDecisionAction,
  UnifiedDecisionInput,
  UnifiedDecisionMode,
  UnifiedPortfolioDecision,
} from "./portfolio-brain-unified-decision-types";

const unifiedInput: UnifiedDecisionInput = {
  portfolioBrainMode: "DEFENSIVE",
  exposureReductions: 4,
  exposureIncreases: 0,
  strictApprovalItems: 4,
  flexibleApprovalItems: 0,
  totalCurrentWeight: 85,
  totalSyncedWeight: 45,
  institutionalConfidenceScore: 68,
  institutionalRiskScore: 97,
  institutionalStrategyScore: 60,
  institutionalBias: "RISK_OFF",
  outcomeLearningImprovingStrategies: 2,
  outcomeLearningWeakeningStrategies: 0,
  adaptiveConfidenceAdjustment: 8,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function resolveFinalDecisionMode(input: UnifiedDecisionInput): UnifiedDecisionMode {
  if (input.institutionalRiskScore >= 95 && input.institutionalBias === "RISK_OFF") {
    return "DEFENSIVE";
  }

  if (input.strictApprovalItems >= 4 && input.exposureReductions >= 4) {
    return "DEFENSIVE";
  }

  if (input.institutionalRiskScore >= 85) {
    return "DEFENSIVE";
  }

  if (input.institutionalRiskScore >= 75 && input.outcomeLearningWeakeningStrategies > 0) {
    return "BLOCKED";
  }

  if (
    input.exposureIncreases > input.exposureReductions &&
    input.institutionalConfidenceScore >= 70 &&
    input.institutionalRiskScore < 60
  ) {
    return "AGGRESSIVE";
  }

  return "NORMAL";
}

function resolveApprovalStrictness(
  mode: UnifiedDecisionMode,
  input: UnifiedDecisionInput,
): UnifiedPortfolioDecision["approvalStrictness"] {
  if (mode === "BLOCKED") return "EXTREME";
  if (mode === "DEFENSIVE" || input.strictApprovalItems >= 3) return "HIGH";
  if (mode === "AGGRESSIVE" && input.flexibleApprovalItems > 0) return "LOW";
  return "NORMAL";
}

function resolvePositionSizeMultiplier(mode: UnifiedDecisionMode, riskScore: number) {
  if (mode === "BLOCKED") return 0;
  if (mode === "DEFENSIVE" && riskScore >= 90) return 0.35;
  if (mode === "DEFENSIVE") return 0.5;
  if (mode === "AGGRESSIVE") return 1.15;
  return 1;
}

function buildActions(
  mode: UnifiedDecisionMode,
  input: UnifiedDecisionInput,
): UnifiedDecisionAction[] {
  const actions: UnifiedDecisionAction[] = [];

  if (mode === "BLOCKED") {
    actions.push("BLOCK_AGGRESSIVE_TRADING");
    actions.push("REQUIRE_STRICT_APPROVAL");
    actions.push("REDUCE_EXPOSURE");
    actions.push("REDUCE_POSITION_SIZE");
    actions.push("SEND_TO_SELF_EVOLUTION_REVIEW");
    return actions;
  }

  if (mode === "DEFENSIVE") {
    actions.push("ALLOW_ONLY_STRONG_SETUPS");
    actions.push("BLOCK_AGGRESSIVE_TRADING");
    actions.push("REQUIRE_STRICT_APPROVAL");
    actions.push("REDUCE_EXPOSURE");
    actions.push("REDUCE_POSITION_SIZE");
  }

  if (mode === "NORMAL") {
    actions.push("ALLOW_TRADING");
  }

  if (mode === "AGGRESSIVE") {
    actions.push("ALLOW_TRADING");
  }

  if (input.outcomeLearningWeakeningStrategies > 0) {
    actions.push("SEND_TO_SELF_EVOLUTION_REVIEW");
  }

  return Array.from(new Set(actions));
}

function buildUnifiedDecision(input: UnifiedDecisionInput): UnifiedPortfolioDecision {
  const weightReductionImpact = input.totalCurrentWeight - input.totalSyncedWeight;

  const finalConfidenceScore = clamp(
    input.institutionalConfidenceScore +
      input.adaptiveConfidenceAdjustment * 1.5 +
      input.outcomeLearningImprovingStrategies * 3 -
      input.outcomeLearningWeakeningStrategies * 6,
  );

  const finalRiskScore = clamp(
    input.institutionalRiskScore +
      input.exposureReductions * 2 -
      input.exposureIncreases * 2 +
      weightReductionImpact * 0.15,
  );

  const finalStrategyScore = clamp(
    input.institutionalStrategyScore +
      input.outcomeLearningImprovingStrategies * 5 -
      input.outcomeLearningWeakeningStrategies * 8,
  );

  const finalDecisionMode = resolveFinalDecisionMode(input);
  const approvalStrictness = resolveApprovalStrictness(finalDecisionMode, input);
  const positionSizeMultiplier = resolvePositionSizeMultiplier(
    finalDecisionMode,
    finalRiskScore,
  );

  const tradingAllowed = finalDecisionMode !== "BLOCKED";
  const aggressiveTradingAllowed = finalDecisionMode === "AGGRESSIVE";
  const normalTradingAllowed = finalDecisionMode === "NORMAL";
  const defensiveTradingRequired = finalDecisionMode === "DEFENSIVE";

  const actions = buildActions(finalDecisionMode, input);

  const reason =
    finalDecisionMode === "DEFENSIVE"
      ? "Unified Portfolio Brain detects elevated institutional risk and reduced strategy weights. Only strongest setups should pass with stricter approval and reduced position sizing."
      : finalDecisionMode === "BLOCKED"
        ? "Unified Portfolio Brain blocks trading because risk and weakening strategy signals are too high."
        : finalDecisionMode === "AGGRESSIVE"
          ? "Unified Portfolio Brain allows controlled aggressive mode because confidence is high and risk is controlled."
          : "Unified Portfolio Brain allows normal trading with standard confirmation checks.";

  return {
    finalDecisionMode,
    finalConfidenceScore: round(finalConfidenceScore),
    finalRiskScore: round(finalRiskScore),
    finalStrategyScore: round(finalStrategyScore),
    tradingAllowed,
    aggressiveTradingAllowed,
    normalTradingAllowed,
    defensiveTradingRequired,
    positionSizeMultiplier,
    approvalStrictness,
    actions,
    reason,
  };
}

export function getPortfolioBrainUnifiedDecisionReport(): PortfolioBrainUnifiedDecisionReport {
  const decision = buildUnifiedDecision(unifiedInput);

  const recommendation =
    decision.finalDecisionMode === "DEFENSIVE"
      ? "Portfolio Brain should stay defensive: reduce exposure, reduce position sizing and allow only high-confidence setups after strict approval."
      : decision.finalDecisionMode === "BLOCKED"
        ? "Portfolio Brain should block new trades and send strategies to Self Evolution review."
        : decision.finalDecisionMode === "AGGRESSIVE"
          ? "Portfolio Brain may allow controlled aggressive setups, but execution still requires approval."
          : "Portfolio Brain can continue normal trading with regular confirmation filters.";

  return {
    version: "V11.8.4",
    status: "READY",
    mode: "SIMULATION",
    input: unifiedInput,
    decision,
    integrationTarget: [
      "Portfolio Brain",
      "Trade Approval Engine",
      "Position Sizing",
      "Execution Queue Engine",
      "Self Evolution",
      "Strategy Weight Auto-Rebalancing",
    ],
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
