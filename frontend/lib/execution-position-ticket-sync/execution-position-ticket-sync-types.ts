import { TradingStyle } from "../smart-broker-selection";

export type ExecutionPositionTicketStatus = "READY" | "WAITING" | "BLOCKED";

export type ExecutionPositionTicketAction =
  | "CREATE_EVOLVED_PAPER_TICKET"
  | "CREATE_SINGLE_BROKER_TICKET"
  | "WAIT"
  | "BLOCK";

export interface EvolvedBrokerTicketAllocation {
  brokerId: string;
  brokerName: string;
  allocationPercent: number;
  lotSize: number;
  notionalRiskPercent: number;
  status: "ACTIVE" | "SKIPPED" | "BLOCKED";
}

export interface ExecutionPositionTicket {
  ticketId: string;
  sourceQueueItemId: string;
  symbol: string;
  side: "BUY" | "SELL" | "NONE";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  selectedBroker: string;
  ticketStatus: ExecutionPositionTicketStatus;
  action: ExecutionPositionTicketAction;
  executionMode: "PAPER" | "LIVE_BLOCKED";
  originalRequestedLots: number;
  evolvedAllocatedLots: number;
  riskPercent: number;
  confidenceScore: number;
  brokerAllocations: EvolvedBrokerTicketAllocation[];
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  maxSlippagePercent: number;
  riskLockEnabled: true;
  readOnlySafe: true;
  liveExecutionBlocked: true;
  reason: string;
  createdAt: string;
}

export interface ExecutionPositionTicketSyncReport {
  version: "V16.3.1";
  status: "READY";
  mode: "SIMULATION";
  totalItems: number;
  readyTickets: number;
  waitingTickets: number;
  blockedTickets: number;
  totalEvolvedLots: number;
  liveExecutionEnabled: false;
  tickets: ExecutionPositionTicket[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
}
