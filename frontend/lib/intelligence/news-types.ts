export type IntelligenceSource =
  | "MOCK"
  | "YAHOO_FINANCE"
  | "CAPITAL_COM"
  | "TRADINGVIEW"
  | "ECONOMIC_CALENDAR"
  | "NEWS_PROVIDER";

export type NewsImpact = "HIGH" | "MEDIUM" | "LOW";
export type NewsSentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  symbols: string[];
  source: IntelligenceSource;
  impact: NewsImpact;
  sentiment: NewsSentiment;
  publishedAt: string;
};

export type MacroEvent = {
  id: string;
  name: string;
  region: "US" | "EU" | "UK" | "CH" | "GLOBAL";
  impact: NewsImpact;
  relatedMarkets: string[];
  expectedAt: string;
  status: "UPCOMING" | "RELEASED" | "ARCHIVED";
};