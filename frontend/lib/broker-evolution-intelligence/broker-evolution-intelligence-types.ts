import { BrokerId } from "../smart-broker-selection";
import { BrokerReputationGrade } from "../broker-reputation-memory";

export type BrokerEvolutionStatus =
  | "READY"
  | "IMPROVING"
  | "STABLE"
  | "DECLINING"
  | "HIGH_RISK"
  | "BLOCKED";

export type BrokerEvolutionMode =
  | "SIMULATION"
  | "READ_ONLY"
  | "PAPER_MODE";

export type BrokerEvolutionTrend =
  | "IMPROVING"
  | "STABLE"
  | "DECLINING"
  | "INSUFFICIENT_DATA";

export type BrokerDecayRisk =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface BrokerEvolutionSnapshot {
  label: string;
  reputationScore: number;
  trustScore: number;
  recommendedWeight: number;
  memoryStrength: number;
}

export interface BrokerEvolutionProfile {
  brokerId: BrokerId;
  brokerName: string;
  currentReputationScore: number;
  currentGrade: BrokerReputationGrade;
  currentStatus: string;
  evolutionTrend: BrokerEvolutionTrend;
  evolutionScore: number;
  growthRate: number;
  decayRisk: BrokerDecayRisk;
  futureTrustProjection: number;
  futureWeightProjection: number;
  stabilityScore: number;
  confidenceScore: number;
  status: BrokerEvolutionStatus;
  snapshots: BrokerEvolutionSnapshot[];
  reasons: string[];
  signals: {
    executionTrustScore: number;
    reliabilityTrustScore: number;
    optimizationTrustScore: number;
    allocationTrustScore: number;
    memoryStrength: number;
    currentLongTermWeight: number;
    executionQualityScore: number;
    trendScore: number;
    reliabilityScore: number;
    optimizationConfidence: number;
  };
}

export interface BrokerEvolutionIntelligenceReport {
  version: "V12.7.0";
  status: BrokerEvolutionStatus;
  mode: BrokerEvolutionMode[];
  totalBrokers: number;
  strongestEvolutionBroker: BrokerId | "NONE";
  weakestEvolutionBroker: BrokerId | "NONE";
  improvingBrokers: number;
  stableBrokers: number;
  decliningBrokers: number;
  highRiskBrokers: number;
  evolutionProfiles: BrokerEvolutionProfile[];
  futureRecommendedWeights: Record<BrokerId, number>;
  summary: string;
  evolutionNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    evolutionMode: "SIMULATED_BROKER_EVOLUTION_INTELLIGENCE";
  };
  createdAt: string;
}
