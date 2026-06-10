export type ConsensusUnifiedDecisionMode =
  | "CONSENSUS_ELITE"
  | "CONSENSUS_APPROVED"
  | "CONSENSUS_STRICT"
  | "CONSENSUS_WAIT"
  | "CONSENSUS_BLOCKED";

export type ConsensusPortfolioBrainRoute =
  | "CONSENSUS_SCALP_ROUTE"
  | "CONSENSUS_DAYTRADE_ROUTE"
  | "CONSENSUS_SWING_ROUTE"
  | "CONSENSUS_MULTI_STYLE_ROUTE"
  | "NO_TRADE_ROUTE";

export type ConsensusUnifiedDecision = {
  id: string;
  symbol: string;
  unifiedDecisionMode: ConsensusUnifiedDecisionMode;
  primaryStyle: string;
  secondaryStyle: string;
  activeDirection: string;
  goCount: number;
  consensusLevel: string;
  consensusScore: number;
  approvalStatus: string;
  executionAllowed: boolean;
  requiresStrictApproval: boolean;
  portfolioBrainRoute: ConsensusPortfolioBrainRoute;
  brokerRoutingMode: "DUAL_BROKER_CHECK" | "SINGLE_BROKER_CHECK" | "NO_BROKER_ROUTE";
  executionPriority: number;
  approvalStrictness: "NORMAL" | "HIGH" | "ELITE_VALIDATION" | "BLOCKED";
  positionSizeMultiplier: number;
  finalPositionSize: number;
  approvedStyles: string[];
  strictApprovalStyles: string[];
  reason: string;
};

export type MultiStyleConsensusUnifiedDecisionSyncReport = {
  version: "V16.1.3";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  eliteSymbols: number;
  approvedSymbols: number;
  strictSymbols: number;
  waitingSymbols: number;
  blockedSymbols: number;
  dualBrokerCheckSymbols: number;
  singleBrokerCheckSymbols: number;
  decisions: ConsensusUnifiedDecision[];
  integrationTarget: string[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
