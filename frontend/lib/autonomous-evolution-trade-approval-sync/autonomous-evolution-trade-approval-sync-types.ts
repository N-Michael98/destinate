export type AutonomousEvolutionTradeApprovalImpact =
  | "BOOST_APPROVAL"
  | "NORMAL_APPROVAL"
  | "STRICT_APPROVAL"
  | "BLOCK_APPROVAL";

export type AutonomousEvolutionTradeApprovalDecision = {
  id: string;
  symbol: string;
  strategy: string;
  direction: string;
  baseApproved: boolean;
  baseStatus: string;
  baseConfidence: number;
  adaptiveConfidence: number;
  baseStrategyWeight: number;
  autonomousWeight: number;
  autonomousWeightStatus: string;
  autonomousWeightChange: number;
  approvalImpact: AutonomousEvolutionTradeApprovalImpact;
  approvalPriority: number;
  positionSizingBias: "ALLOW_SIZE_INCREASE" | "NORMAL_SIZE" | "REDUCE_SIZE" | "BLOCK_SIZE";
  finalApproved: boolean;
  finalStatus: "APPROVED" | "REVIEW" | "REJECTED" | "BLOCKED";
  reason: string;
};

export type AutonomousEvolutionTradeApprovalSyncReport = {
  version: "V16.0.7";
  status: "READY";
  mode: "SIMULATION";
  cycleDecision: string;
  autonomousEvolutionScore: number;
  totalCandidates: number;
  approvedCandidates: number;
  reviewCandidates: number;
  rejectedCandidates: number;
  blockedCandidates: number;
  boostApprovalItems: number;
  strictApprovalItems: number;
  normalApprovalItems: number;
  blockApprovalItems: number;
  bestCandidate: AutonomousEvolutionTradeApprovalDecision | null;
  decisions: AutonomousEvolutionTradeApprovalDecision[];
  recommendation: string;
  updatedAt: string;
};
