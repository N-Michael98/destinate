export type PortfolioBrokerRoutingMode =
  | "DUAL_BROKER_PRIORITY"
  | "DUAL_BROKER_CHECK"
  | "SINGLE_BROKER_CHECK"
  | "NO_BROKER_ROUTE";

export type PortfolioBrokerSelectionDecision = {
  id: string;
  symbol: string;
  primaryStyle: string;
  consensusMode: string;
  consensusLevel: string;
  portfolioPriority: string;
  brokerRoutingMode: PortfolioBrokerRoutingMode;
  selectedBroker: string;
  primaryBroker: string;
  secondaryBroker: string;
  capitalComAllocation: number;
  icMarketsAllocation: number;
  executionPriority: number;
  finalPositionSize: number;
  riskAdjustment: number;
  approvalRequired: boolean;
  brokerSelectionSummary: string;
  reason: string;
};

export type PortfolioBrainBrokerSelectionSyncReport = {
  version: "V16.1.5";
  status: "READY";
  mode: "SIMULATION";
  totalSymbols: number;
  dualBrokerPrioritySymbols: number;
  dualBrokerCheckSymbols: number;
  singleBrokerCheckSymbols: number;
  blockedSymbols: number;
  bestDecision: PortfolioBrokerSelectionDecision | null;
  decisions: PortfolioBrokerSelectionDecision[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
