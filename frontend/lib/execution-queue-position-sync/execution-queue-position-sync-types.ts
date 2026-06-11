import { BrokerId, TradingStyle } from "../smart-broker-selection";

export type ExecutionQueuePositionSyncStatus =
  | "SYNCED"
  | "PARTIAL_SYNC"
  | "BLOCKED"
  | "READY";

export type ExecutionQueuePositionSyncMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export interface SyncedBrokerAllocation {
  brokerId: BrokerId;
  brokerName: string;
  allocationPercent: number;
  brokerScore: number;
  lotSize: number;
  notionalRiskPercent: number;
  status: "ACTIVE" | "SKIPPED" | "BLOCKED";
  reason: string;
}

export interface PositionSyncedQueueItem {
  queueItemId: string;
  symbol: string;
  side: "BUY" | "SELL" | "NONE";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  selectedBroker: BrokerId | "MIXED" | "NONE";
  originalRequestedLots: number;
  evolvedAllocatedLots: number;
  unallocatedLots: number;
  riskPercent: number;
  confidenceScore: number;
  brokerAllocations: SyncedBrokerAllocation[];
  syncStatus: ExecutionQueuePositionSyncStatus;
  readyForPaperExecution: boolean;
  liveExecutionBlocked: true;
  syncReason: string;
}

export interface ExecutionQueuePositionSyncReport {
  version: "V16.3.0";
  status: ExecutionQueuePositionSyncStatus;
  mode: ExecutionQueuePositionSyncMode[];
  totalItems: number;
  syncedItems: number;
  partialSyncItems: number;
  blockedItems: number;
  readyForPaperExecutionItems: number;
  totalEvolvedLots: number;
  totalUnallocatedLots: number;
  items: PositionSyncedQueueItem[];
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    positionSyncMode: "EVOLVED_ALLOCATION_INJECT";
  };
  updatedAt: string;
}
