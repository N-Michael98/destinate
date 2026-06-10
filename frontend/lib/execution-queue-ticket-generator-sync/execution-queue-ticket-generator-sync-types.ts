export type ExecutionTicketStatus =
  | "READY"
  | "WAITING"
  | "BLOCKED";

export type ExecutionTicketAction =
  | "CREATE_PAPER_EXECUTION_TICKET"
  | "CREATE_SINGLE_BROKER_TICKET"
  | "WAIT"
  | "BLOCK";

export type ExecutionQueueTicket = {
  ticketId: string;
  sourceQueueId: string;
  queueRank: number;
  symbol: string;
  side: "BUY" | "SELL" | "NONE";
  tradingStyle: string;
  brokerTarget: "DUAL_BROKER" | "SINGLE_BROKER" | "NO_BROKER";
  preferredBroker: string;
  secondaryBroker: string;
  action: ExecutionTicketAction;
  ticketStatus: ExecutionTicketStatus;
  executionMode: "PAPER" | "SIMULATION" | "LIVE_BLOCKED";
  executionPriority: number;
  originalPositionSize: number;
  allocatedPositionSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  maxSlippagePercent: number;
  riskLockEnabled: true;
  readOnlySafe: true;
  liveExecutionBlocked: true;
  reason: string;
  createdAt: string;
};

export type ExecutionQueueTicketGeneratorSyncReport = {
  version: "V16.1.9";
  status: "READY";
  mode: "SIMULATION";
  totalQueueItems: number;
  readyTickets: number;
  waitingTickets: number;
  blockedTickets: number;
  dualBrokerTickets: number;
  singleBrokerTickets: number;
  liveExecutionEnabled: false;
  tickets: ExecutionQueueTicket[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
