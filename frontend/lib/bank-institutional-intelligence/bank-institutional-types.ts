export type InstitutionalSourceType =
  | "CENTRAL_BANK"
  | "MAJOR_BANK"
  | "GLOBAL_INSTITUTION";

export type MarketImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type InstitutionalSource = {
  id: string;
  name: string;
  type: InstitutionalSourceType;
  region: string;
  focusAreas: string[];
  supportedMarkets: string[];
  impactLevel: MarketImpactLevel;
  sourceUsage: string;
  officialSourceUrl: string;
};

export type InstitutionalIntelligenceSignal = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: InstitutionalSourceType;
  region: string;
  marketBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "RISK_OFF" | "RISK_ON";
  affectedMarkets: string[];
  confidenceImpact: number;
  riskImpact: number;
  strategyImpact: number;
  impactLevel: MarketImpactLevel;
  reason: string;
  createdAt: string;
};

export type BankInstitutionalIntelligenceReport = {
  version: "V11.7.3";
  status: "READY";
  mode: "SIMULATION";
  totalSources: number;
  centralBankSources: number;
  majorBankSources: number;
  globalInstitutionSources: number;
  totalSignals: number;
  highImpactSignals: number;
  criticalImpactSignals: number;
  averageConfidenceImpact: number;
  averageRiskImpact: number;
  sources: InstitutionalSource[];
  signals: InstitutionalIntelligenceSignal[];
  recommendation: string;
  integrationTarget: string[];
  updatedAt: string;
};
