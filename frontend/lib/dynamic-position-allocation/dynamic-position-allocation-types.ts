import { BrokerId, TradingStyle } from "../smart-broker-selection";

export type DynamicPositionAllocationStatus =
  | "READY"
  | "ALLOCATED"
  | "PARTIAL_ALLOCATION"
  | "BLOCKED";

export type DynamicPositionAllocationMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export interface DynamicPositionAllocationInput {
  queueItemId: string;
  symbol: string;
  tradeDirection: "LONG" | "SHORT";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  selectedBroker: BrokerId | "MIXED" | "NONE";
  totalPositionSizeLots: number;
  maxPositionSizeLots: number;
  riskPercent: number;
  confidenceScore: number;
  routes: {
    brokerId: BrokerId;
    brokerName: string;
    allocationPercent: number;
    brokerScore: number;
    routeStatus: "ACTIVE" | "STANDBY" | "BLOCKED";
  }[];
}

export interface BrokerPositionAllocation {
  brokerId: BrokerId;
  brokerName: string;
  allocationPercent: number;
  brokerScore: number;
  lotSize: number;
  notionalRiskPercent: number;
  status: "ACTIVE" | "SKIPPED" | "BLOCKED";
  reason: string;
}

export interface DynamicPositionAllocationResult {
  queueItemId: string;
  symbol: string;
  tradeDirection: "LONG" | "SHORT";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: DynamicPositionAllocationStatus;
  selectedBroker: BrokerId | "MIXED" | "NONE";
  totalRequestedLots: number;
  totalAllocatedLots: number;
  unallocatedLots: number;
  riskPercent: number;
  confidenceScore: number;
  allocations: BrokerPositionAllocation[];
  allocationReason: string;
}

export interface DynamicPositionAllocationReport {
  version: "V12.2.0";
  status: DynamicPositionAllocationStatus;
  mode: DynamicPositionAllocationMode[];
  totalItems: number;
  allocatedItems: number;
  partialAllocationItems: number;
  blockedItems: number;
  totalRequestedLots: number;
  totalAllocatedLots: number;
  totalUnallocatedLots: number;
  results: DynamicPositionAllocationResult[];
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    allocationMode: "SIMULATED_POSITION_SPLIT";
  };
  createdAt: string;
}
