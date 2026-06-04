export type NewsCategory =
  | "MACRO"
  | "GEOPOLITICAL"
  | "CENTRAL_BANK"
  | "COMMODITIES"
  | "EQUITIES"
  | "FX"
  | "CRYPTO"
  | "SYSTEM";

export type NewsImpact =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type NewsSentiment =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "RISK_ON"
  | "RISK_OFF";

export type NewsItem = {
  id: string;
  title: string;
  category: NewsCategory;
  impact: NewsImpact;
  sentiment: NewsSentiment;
  affectedMarkets: string[];
  source: string;
  summary: string;
  timestamp: string;
};

export type NewsIntelligenceReport = {
  version: string;
  totalNews: number;
  highImpactNews: number;
  geopoliticalRisk: NewsImpact;
  macroRisk: NewsImpact;
  overallSentiment: NewsSentiment;
  marketRiskScore: number;
  affectedMarkets: string[];
  recommendation: string;
  news: NewsItem[];
  updatedAt: string;
};