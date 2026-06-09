export type RegimeAISyncItem = {
  symbol: string;
  price: number;
  primaryRegime: string;
  trend: string;
  trendScore: number;
  volatility: string;
  volatilityScore: number;
  risk: string;
  riskScore: number;
  confidence: number;
  preferredStrategyBias: string;
  gptBias: string;
  gptConfidence: number;
  gptReasoning: string;
  claudeApproved: boolean;
  claudeRisk: string;
  claudeConfidence: number;
  claudeReasoning: string;
  finalAiBias: "LONG_BIAS" | "SHORT_BIAS" | "WAIT" | "RISK_REDUCED";
  recommendation: string;
};

export type RegimeAISyncReport = {
  version: "V16.0.7.C";
  status: "READY";
  mode: "SIMULATION";
  totalMarkets: number;
  longBiasMarkets: number;
  shortBiasMarkets: number;
  waitMarkets: number;
  riskReducedMarkets: number;
  topAiOpportunity: RegimeAISyncItem | null;
  items: RegimeAISyncItem[];
  summary: string;
  updatedAt: string;
};
