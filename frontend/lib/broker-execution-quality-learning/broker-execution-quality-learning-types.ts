import { BrokerId, TradingStyle } from "../smart-broker-selection";

export type BrokerExecutionLearningStatus =
  | "READY"
  | "LEARNING"
  | "DEGRADED"
  | "BLOCKED";

export type BrokerExecutionLearningMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type ExecutionOutcomeStatus =
  | "FILLED"
  | "PARTIAL_FILL"
  | "REJECTED"
  | "SIMULATED";

export interface BrokerExecutionQualitySample {
  id: string;
  brokerId: BrokerId;
  brokerName: string;
  symbol: string;
  tradingStyle: TradingStyle;
  tradeDirection: "LONG" | "SHORT";
  requestedLots: number;
  filledLots: number;
  expectedPrice: number;
  executedPrice: number;
  spreadPoints: number;
  slippagePoints: number;
  latencyMs: number;
  fillQualityScore: number;
  liquidityScore: number;
  rejectionRiskScore: number;
  executionOutcome: ExecutionOutcomeStatus;
  createdAt: string;
}

export interface BrokerExecutionQualityMemory {
  brokerId: BrokerId;
  brokerName: string;
  totalSamples: number;
  filledSamples: number;
  partialFillSamples: number;
  rejectedSamples: number;
  averageLatencyMs: number;
  averageSpreadPoints: number;
  averageSlippagePoints: number;
  averageFillQualityScore: number;
  averageLiquidityScore: number;
  averageRejectionRiskScore: number;
  executionQualityScore: number;
  learningStatus: BrokerExecutionLearningStatus;
  strengths: string[];
  weaknesses: string[];
}

export interface BrokerExecutionQualityLearningReport {
  version: "V12.3.0";
  status: BrokerExecutionLearningStatus;
  mode: BrokerExecutionLearningMode[];
  totalSamples: number;
  brokerMemories: BrokerExecutionQualityMemory[];
  bestBroker: BrokerId | "NONE";
  weakestBroker: BrokerId | "NONE";
  summary: string;
  learningNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    learningMode: "SIMULATED_EXECUTION_QUALITY_MEMORY";
  };
  createdAt: string;
}
