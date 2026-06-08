export type SpeciesTradeApprovalSyncStatus = "READY";

export type TradeApprovalSyncSpecies =
  | "HYBRID"
  | "LIQUIDITY"
  | "TREND"
  | "INSTITUTIONAL"
  | "BREAKOUT"
  | "MEAN_REVERSION";

export type ApprovalSyncTicketStatus =
  | "APPROVAL_READY"
  | "APPROVAL_LIMITED"
  | "APPROVAL_BLOCKED";

export type ApprovalPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED";

export type SpeciesTradeApprovalSyncTicket = {
  sourceExecutionCenterTicketId: string;
  tradeApprovalTicketId: string;
  species: TradeApprovalSyncSpecies;
  symbol: "XAUUSD";
  side: "PENDING_SIGNAL";
  orderIntent: "SPECIES_EVOLUTION_EXECUTION";
  approvalPriority: ApprovalPriority;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  approvalStatus: ApprovalSyncTicketStatus;
  riskGateRequired: boolean;
  brokerRoutingGateRequired: boolean;
  executionQueueRequired: boolean;
  maxRiskAllowed: boolean;
  approvalRole: string;
};

export type SpeciesTradeApprovalSyncReport = {
  version: "V14.9.0";
  status: SpeciesTradeApprovalSyncStatus;
  mode: "SIMULATION";
  source: "SPECIES_EXECUTION_CENTER_SYNC";
  target: "TRADE_APPROVAL_ENGINE";
  symbol: "XAUUSD";
  totalSourceTickets: number;
  totalApprovalTickets: number;
  approvalReadyTickets: number;
  approvalLimitedTickets: number;
  approvalBlockedTickets: number;
  totalApprovalCapitalUsd: number;
  totalApprovalPositionSizeUsd: number;
  totalApprovalLotSize: number;
  primarySpecies: TradeApprovalSyncSpecies;
  approvalTickets: SpeciesTradeApprovalSyncTicket[];
  blockedSpecies: TradeApprovalSyncSpecies[];
  summary: string;
};
