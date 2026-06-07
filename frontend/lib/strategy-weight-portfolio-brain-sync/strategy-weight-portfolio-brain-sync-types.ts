export type StrategyWeightPortfolioBrainSyncDecision = {
  id: string;
  strategy: string;
  symbol: string;
  currentWeight: number;
  recommendedWeight: number;
  weightChange: number;
  status: string;
  portfolioBrainImpact: "INCREASE_EXPOSURE" | "REDUCE_EXPOSURE" | "HOLD_EXPOSURE";
  tradeApprovalImpact: "STRICTER_APPROVAL" | "NORMAL_APPROVAL" | "FLEXIBLE_APPROVAL";
  positionSizingImpact: "REDUCE_SIZE" | "NORMAL_SIZE" | "ALLOW_SIZE_INCREASE";
  reason: string;
};

export type StrategyWeightPortfolioBrainSyncReport = {
  version: "V11.8.2";
  status: "READY";
  mode: "SIMULATION";
  totalSyncItems: number;
  exposureIncreases: number;
  exposureReductions: number;
  exposureHolds: number;
  strictApprovalItems: number;
  normalApprovalItems: number;
  flexibleApprovalItems: number;
  totalCurrentWeight: number;
  totalSyncedWeight: number;
  portfolioBrainMode: "DEFENSIVE" | "NORMAL" | "AGGRESSIVE";
  decisions: StrategyWeightPortfolioBrainSyncDecision[];
  aiCommunicationNote: string;
  recommendation: string;
  updatedAt: string;
};
