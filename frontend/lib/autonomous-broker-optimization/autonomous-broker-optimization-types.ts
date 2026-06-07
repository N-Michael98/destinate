import { BrokerId } from "../smart-broker-selection";

export type AutonomousBrokerOptimizationStatus =
  | "READY"
  | "OPTIMIZED"
  | "MONITORING"
  | "BLOCKED";

export type AutonomousBrokerOptimizationMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type BrokerOptimizationAction =
  | "INCREASE_WEIGHT"
  | "DECREASE_WEIGHT"
  | "HOLD_WEIGHT"
  | "BLOCK_BROKER";

export interface BrokerOptimizationProfile {
  brokerId: BrokerId;
  brokerName: string;
  currentNormalizedWeight: number;
  executionQualityScore: number;
  finalAdaptiveWeight: number;
  trendScore: number;
  reliabilityScore: number;
  optimizationConfidence: number;
  recommendedWeight: number;
  recommendedAction: BrokerOptimizationAction;
  status: AutonomousBrokerOptimizationStatus;
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

export interface AutonomousBrokerOptimizationReport {
  version: "V12.5.0";
  status: AutonomousBrokerOptimizationStatus;
  mode: AutonomousBrokerOptimizationMode[];
  totalBrokers: number;
  recommendedBroker: BrokerId | "NONE";
  strongestBroker: BrokerId | "NONE";
  weakestBroker: BrokerId | "NONE";
  optimizationProfiles: BrokerOptimizationProfile[];
  optimizedWeights: Record<BrokerId, number>;
  summary: string;
  optimizationNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    optimizationMode: "SIMULATED_AUTONOMOUS_BROKER_OPTIMIZATION";
  };
  createdAt: string;
}
