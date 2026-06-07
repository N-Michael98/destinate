import { BrokerId } from "../smart-broker-selection";

export type AdaptiveBrokerWeightingStatus =
  | "READY"
  | "ADJUSTED"
  | "LEARNING"
  | "BLOCKED";

export type AdaptiveBrokerWeightingMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export interface BrokerAdaptiveWeight {
  brokerId: BrokerId;
  brokerName: string;
  executionQualityScore: number;
  baseWeight: number;
  adaptiveAdjustment: number;
  finalWeight: number;
  status: AdaptiveBrokerWeightingStatus;
  reasons: string[];
  metrics: {
    averageLatencyMs: number;
    averageSpreadPoints: number;
    averageSlippagePoints: number;
    averageFillQualityScore: number;
    averageLiquidityScore: number;
    averageRejectionRiskScore: number;
    totalSamples: number;
  };
}

export interface AdaptiveBrokerWeightingReport {
  version: "V12.4.0";
  status: AdaptiveBrokerWeightingStatus;
  mode: AdaptiveBrokerWeightingMode[];
  totalBrokers: number;
  bestWeightedBroker: BrokerId | "NONE";
  weakestWeightedBroker: BrokerId | "NONE";
  brokerWeights: BrokerAdaptiveWeight[];
  normalizedWeights: Record<BrokerId, number>;
  summary: string;
  learningNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    weightingMode: "SIMULATED_ADAPTIVE_BROKER_WEIGHTING";
  };
  createdAt: string;
}
