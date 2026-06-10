export type DualBrokerExecutionQueueStatus =
  | "READY_FOR_PAPER_EXECUTION"
  | "SINGLE_BROKER_READY"
  | "WAITING_FOR_APPROVAL"
  | "BLOCKED";

export type DualBrokerExecutionQueueItem = {
  id: string;
  queueRank: number;
  symbol: string;
  tradingStyle: string;
  direction: string;
  queueStatus: DualBrokerExecutionQueueStatus;
  requestedAction: "OPEN_TRADE" | "WAIT" | "BLOCK";
  brokerTarget: "DUAL_BROKER" | "SINGLE_BROKER" | "NO_BROKER";
  preferredBroker: string;
  secondaryBroker: string;
  executionPriority: number;
  originalPositionSize: number;
  allocatedPositionSize: number;
  executionMode: "SIMULATION" | "PAPER" | "LIVE_BLOCKED";
  readOnlySafe: true;
  liveExecutionBlocked: true;
  reason: string;
  createdAt: string;
};

export type DualBrokerExecutionQueueSyncReport = {
  version: "V16.1.8";
  status: "READY";
  mode: "SIMULATION";
  totalItems: number;
  readyForPaperExecution: number;
  singleBrokerReady: number;
  waitingItems: number;
  blockedItems: number;
  executionAllowed: boolean;
  liveExecutionEnabled: false;
  queue: DualBrokerExecutionQueueItem[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
