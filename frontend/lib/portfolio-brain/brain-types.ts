export type BrainDecision =
  | "LONG"
  | "SHORT"
  | "WAIT"
  | "BLOCK";

export type BrainSource =
  | "GPT"
  | "CLAUDE"
  | "AGENT"
  | "CONSENSUS"
  | "PORTFOLIO"
  | "REGIME"
  | "ECONOMIC"
  | "NEWS"
  | "LEARNING";

export type BrainRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "EXTREME";

export interface BrainInput {
  source: BrainSource;
  signal: BrainDecision;
  confidence: number;
  riskScore: number;
  reason: string;
}

export interface BrainResult {
  version: string;
  approved: boolean;
  finalDecision: BrainDecision;
  confidence: number;
  averageConfidence: number;
  averageRiskScore: number;
  agreementScore: number;
  riskLevel: BrainRiskLevel;
  explanation: string;
  inputs: BrainInput[];
  updatedAt: string;
}

export interface BrainSafetyResult {
  safe: boolean;
  safetyScore: number;
  blockReason: string | null;
  maxRiskAllowed: number;
  liveTradingEnabled: false;
}

export interface PortfolioBrainReport {
  version: string;
  status: "READY";
  mode: "SIMULATION";
  inputs: BrainInput[];
  decision: BrainResult;
  safety: BrainSafetyResult;
  recommendation: string;
  liveTradingEnabled: false;
  generatedAt: string;
}