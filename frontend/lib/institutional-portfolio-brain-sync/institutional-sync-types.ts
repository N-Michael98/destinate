export type InstitutionalBias =
  | "RISK_ON"
  | "RISK_OFF"
  | "MIXED"
  | "NEUTRAL";

export type InstitutionalPortfolioBrainSignal = {
  id: string;
  sourceName: string;
  sourceType: string;
  marketBias: string;
  affectedMarkets: string[];
  confidenceImpact: number;
  riskImpact: number;
  strategyImpact: number;
  impactLevel: string;
  reason: string;
};

export type PortfolioBrainInstitutionalAdjustment = {
  institutionalConfidenceScore: number;
  institutionalRiskScore: number;
  institutionalStrategyScore: number;
  portfolioBrainConfidenceAdjustment: number;
  portfolioBrainRiskAdjustment: number;
  portfolioBrainStrategyAdjustment: number;
  allowAggressiveTrading: boolean;
  allowNormalTrading: boolean;
  requireDefensiveMode: boolean;
  institutionalBias: InstitutionalBias;
  affectedMarkets: string[];
  reason: string;
};

export type InstitutionalPortfolioBrainSyncReport = {
  version: "V11.7.5";
  status: "READY";
  mode: "SIMULATION";
  totalInstitutionalSignals: number;
  criticalSignals: number;
  highImpactSignals: number;
  institutionalSignals: InstitutionalPortfolioBrainSignal[];
  portfolioBrainAdjustment: PortfolioBrainInstitutionalAdjustment;
  integrationTarget: string[];
  recommendation: string;
  updatedAt: string;
};
