export type ConsensusTradeApprovalStatus =
  | "APPROVED"
  | "STRICT_APPROVAL_REQUIRED"
  | "REJECTED"
  | "BLOCKED";

export type ConsensusTradeApprovalGateStatus =
  | "PASS"
  | "STRICT_PASS"
  | "FAIL"
  | "BLOCK";

export type ConsensusTradeApprovalGate = {
  id: string;
  name: string;
  status: ConsensusTradeApprovalGateStatus;
  score: number;
  threshold: number;
  required: boolean;
  reason: string;
};

export type ConsensusTradeApprovalDecision = {
  id: string;
  symbol: string;
  primaryStyle: string;
  secondaryStyle: string;
  activeDirection: string;
  goCount: number;
  consensusLevel: string;
  consensusScore: number;
  consensusStatus: string;
  approvalStatus: ConsensusTradeApprovalStatus;
  allowExecution: boolean;
  requireStrictApproval: boolean;
  approvedStyles: string[];
  strictApprovalStyles: string[];
  positionSizeMultiplier: number;
  finalPositionSize: number;
  passedGates: number;
  strictPassedGates: number;
  failedGates: number;
  blockedGates: number;
  gates: ConsensusTradeApprovalGate[];
  reason: string;
};

export type MultiStyleConsensusTradeApprovalSyncReport = {
  version: "V16.1.2";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  approvedSymbols: number;
  strictApprovalSymbols: number;
  rejectedSymbols: number;
  blockedSymbols: number;
  lowConfidenceSymbols: number;
  highConfidenceSymbols: number;
  eliteConfidenceSymbols: number;
  decisions: ConsensusTradeApprovalDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
