export type EconomicEventImpact = "LOW" | "MEDIUM" | "HIGH";

export type EconomicEventStatus =
  | "UPCOMING"
  | "RELEASED"
  | "DELAYED"
  | "UNKNOWN";

export type EconomicEvent = {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: EconomicEventImpact;
  status: EconomicEventStatus;
  scheduledTime: string;
  previous?: string;
  forecast?: string;
  actual?: string;
  category: string;
  affectedMarkets: string[];
};

export type EconomicCalendarReport = {
  version: string;
  generatedAt: string;
  totalEvents: number;
  highImpactEvents: number;
  upcomingHighImpactEvents: EconomicEvent[];
  events: EconomicEvent[];
};