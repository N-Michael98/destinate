export type EconomicEventImpact = "LOW" | "MEDIUM" | "HIGH";

export type EconomicEventStatus =
  | "UPCOMING"
  | "RELEASED"
  | "DELAYED"
  | "UNKNOWN";

export type EconomicCalendarRiskLevel =
  | "NORMAL"
  | "ELEVATED"
  | "HIGH"
  | "EXTREME";

export type EconomicCalendarTradingAction =
  | "NORMAL_TRADING"
  | "REDUCE_RISK"
  | "AVOID_NEW_POSITIONS"
  | "NEWS_LOCKDOWN";

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

export type EconomicRiskAlert = {
  id: string;
  eventId: string;
  title: string;
  currency: string;
  impact: EconomicEventImpact;
  riskLevel: EconomicCalendarRiskLevel;
  tradingAction: EconomicCalendarTradingAction;
  minutesUntilEvent: number;
  reason: string;
  affectedMarkets: string[];
};

export type EconomicCalendarReport = {
  version: string;
  generatedAt: string;
  totalEvents: number;
  highImpactEvents: number;
  upcomingHighImpactEvents: EconomicEvent[];
  riskScore: number;
  riskLevel: EconomicCalendarRiskLevel;
  tradingAction: EconomicCalendarTradingAction;
  riskAlerts: EconomicRiskAlert[];
  recommendation: string;
  events: EconomicEvent[];
};