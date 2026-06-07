import { BrokerId } from "../smart-broker-selection";

export type BrokerReputationMemoryStatus =
  | "READY"
  | "TRUSTED"
  | "WATCHLIST"
  | "DEGRADED"
  | "BLOCKED";

export type BrokerReputationMemoryMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type BrokerReputationGrade =
  | "A_PLUS"
  | "A"
  | "B"
  | "C"
  | "D"
  | "F";

export interface BrokerReputationMemoryItem {
  brokerId: BrokerId;
  brokerName: string;
  reputationScore: number;
  reputationGrade: BrokerReputationGrade;
  status: BrokerReputationMemoryStatus;
  executionTrustScore: number;
  reliabilityTrustScore: number;
  optimizationTrustScore: number;
  allocationTrustScore: number;
  longTermBrokerGrade: BrokerReputationGrade;
  recommendedLongTermWeight: number;
  currentOptimizedWeight: number;
  memoryStrength: number;
  reasons: string[];
  memorySignals: {
    executionQualityScore: number;
    trendScore: number;
    reliabilityScore: number;
    optimizationConfidence: number;
    currentNormalizedWeight: number;
    recommendedWeight: number;
    totalSamples: number;
    averageLatencyMs: number;
    averageSpreadPoints: number;
    averageSlippagePoints: number;
    averageFillQualityScore: number;
    averageLiquidityScore: number;
    averageRejectionRiskScore: number;
  };
}

export interface BrokerReputationMemoryReport {
  version: "V12.6.0";
  status: BrokerReputationMemoryStatus;
  mode: BrokerReputationMemoryMode[];
  totalBrokers: number;
  topReputationBroker: BrokerId | "NONE";
  weakestReputationBroker: BrokerId | "NONE";
  reputationMemories: BrokerReputationMemoryItem[];
  longTermRecommendedWeights: Record<BrokerId, number>;
  summary: string;
  memoryNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    memoryMode: "SIMULATED_BROKER_REPUTATION_MEMORY";
  };
  createdAt: string;
}
