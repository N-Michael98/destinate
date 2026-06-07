export type UnifiedDecisionMode =
  | "AGGRESSIVE"
  | "NORMAL"
  | "DEFENSIVE"
  | "BLOCKED";

export type UnifiedDecisionAction =
  | "ALLOW_TRADING"
  | "ALLOW_ONLY_STRONG_SETUPS"
  | "REDUCE_EXPOSURE"
  | "REDUCE_POSITION_SIZE"
  | "REQUIRE_STRICT_APPROVAL"
  | "BLOCK_AGGRESSIVE_TRADING"
  | "SEND_TO_SELF_EVOLUTION_REVIEW";

export type UnifiedDecisionInput = {
  portfolioBrainMode: "DEFENSIVE" | "NORMAL" | "AGGRESSIVE";
  exposureReductions: number;
  exposureIncreases: number;
  strictApprovalItems: number;
  flexibleApprovalItems: number;
  totalCurrentWeight: number;
  totalSyncedWeight: number;
  institutionalConfidenceScore: number;
  institutionalRiskScore: number;
  institutionalStrategyScore: number;
  institutionalBias: "RISK_ON" | "RISK_OFF" | "MIXED" | "NEUTRAL";
  outcomeLearningImprovingStrategies: number;
  outcomeLearningWeakeningStrategies: number;
  adaptiveConfidenceAdjustment: number;
};

export type UnifiedPortfolioDecision = {
  finalDecisionMode: UnifiedDecisionMode;
  finalConfidenceScore: number;
  finalRiskScore: number;
  finalStrategyScore: number;
  tradingAllowed: boolean;
  aggressiveTradingAllowed: boolean;
  normalTradingAllowed: boolean;
  defensiveTradingRequired: boolean;
  positionSizeMultiplier: number;
  approvalStrictness: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  actions: UnifiedDecisionAction[];
  reason: string;
};

export type PortfolioBrainUnifiedDecisionReport = {
  version: "V11.8.4";
  status: "READY";
  mode: "SIMULATION";
  input: UnifiedDecisionInput;
  decision: UnifiedPortfolioDecision;
  integrationTarget: string[];
  recommendation: string;
  updatedAt: string;
};
