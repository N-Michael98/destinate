import {
  EconomicCalendarReport,
  EconomicCalendarRiskLevel,
  EconomicCalendarTradingAction,
  EconomicEvent,
  EconomicRiskAlert,
} from "./economic-calendar-types";

const demoEvents: EconomicEvent[] = [
  {
    id: "us-cpi",
    title: "US CPI Inflation Rate",
    country: "United States",
    currency: "USD",
    impact: "HIGH",
    status: "UPCOMING",
    scheduledTime: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
    previous: "3.4%",
    forecast: "3.2%",
    category: "Inflation",
    affectedMarkets: ["XAUUSD", "EURUSD", "US500", "NAS100", "DXY"],
  },
  {
    id: "us-nfp",
    title: "US Non-Farm Payrolls",
    country: "United States",
    currency: "USD",
    impact: "HIGH",
    status: "UPCOMING",
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    previous: "175K",
    forecast: "190K",
    category: "Labor Market",
    affectedMarkets: ["XAUUSD", "EURUSD", "US500", "NAS100", "DXY"],
  },
  {
    id: "fed-speech",
    title: "Federal Reserve Speech",
    country: "United States",
    currency: "USD",
    impact: "MEDIUM",
    status: "UPCOMING",
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    category: "Central Bank",
    affectedMarkets: ["XAUUSD", "EURUSD", "DXY"],
  },
  {
    id: "eu-gdp",
    title: "Eurozone GDP Growth Rate",
    country: "Eurozone",
    currency: "EUR",
    impact: "MEDIUM",
    status: "UPCOMING",
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    previous: "0.1%",
    forecast: "0.2%",
    category: "Growth",
    affectedMarkets: ["EURUSD", "DAX", "EU50"],
  },
];

function getMinutesUntilEvent(event: EconomicEvent): number {
  return Math.round(
    (new Date(event.scheduledTime).getTime() - Date.now()) / 1000 / 60
  );
}

function getAlertScore(event: EconomicEvent, minutesUntilEvent: number): number {
  let score = 0;

  if (event.impact === "HIGH") score += 40;
  if (event.impact === "MEDIUM") score += 20;
  if (event.impact === "LOW") score += 5;

  if (minutesUntilEvent <= 120) score += 35;
  else if (minutesUntilEvent <= 240) score += 25;
  else if (minutesUntilEvent <= 1440) score += 15;

  const title = event.title.toLowerCase();
  const category = event.category.toLowerCase();

  if (
    title.includes("cpi") ||
    title.includes("inflation") ||
    title.includes("non-farm") ||
    title.includes("payroll") ||
    title.includes("fomc") ||
    title.includes("interest rate")
  ) {
    score += 20;
  }

  if (
    category.includes("central bank") ||
    category.includes("inflation") ||
    category.includes("labor")
  ) {
    score += 10;
  }

  return Math.min(score, 100);
}

function getRiskLevel(score: number): EconomicCalendarRiskLevel {
  if (score >= 85) return "EXTREME";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "ELEVATED";
  return "NORMAL";
}

function getTradingAction(
  riskLevel: EconomicCalendarRiskLevel
): EconomicCalendarTradingAction {
  if (riskLevel === "EXTREME") return "NEWS_LOCKDOWN";
  if (riskLevel === "HIGH") return "AVOID_NEW_POSITIONS";
  if (riskLevel === "ELEVATED") return "REDUCE_RISK";
  return "NORMAL_TRADING";
}

function createRiskAlert(event: EconomicEvent): EconomicRiskAlert | null {
  const minutesUntilEvent = getMinutesUntilEvent(event);

  if (event.status !== "UPCOMING") return null;
  if (minutesUntilEvent < 0) return null;
  if (minutesUntilEvent > 1440) return null;

  const score = getAlertScore(event, minutesUntilEvent);
  const riskLevel = getRiskLevel(score);
  const tradingAction = getTradingAction(riskLevel);

  if (riskLevel === "NORMAL") return null;

  return {
    id: `alert-${event.id}`,
    eventId: event.id,
    title: event.title,
    currency: event.currency,
    impact: event.impact,
    riskLevel,
    tradingAction,
    minutesUntilEvent,
    reason: `${event.title} is scheduled in ${minutesUntilEvent} minutes and may increase volatility across ${event.affectedMarkets.join(
      ", "
    )}.`,
    affectedMarkets: event.affectedMarkets,
  };
}

function buildRecommendation(
  riskLevel: EconomicCalendarRiskLevel,
  tradingAction: EconomicCalendarTradingAction,
  alerts: EconomicRiskAlert[]
): string {
  if (riskLevel === "EXTREME") {
    return "Extreme economic calendar risk detected. Avoid new positions and keep the system in news lockdown until the event window is cleared.";
  }

  if (riskLevel === "HIGH") {
    return "High-impact macro risk detected. Avoid opening new positions and reduce exposure on affected markets.";
  }

  if (riskLevel === "ELEVATED") {
    return "Elevated economic risk detected. Reduce position size, avoid over-leverage and wait for cleaner market conditions.";
  }

  return `Economic calendar risk is normal. Trading action: ${tradingAction}. Active alerts: ${alerts.length}.`;
}

export function generateEconomicCalendarReport(): EconomicCalendarReport {
  const highImpactEvents = demoEvents.filter((event) => event.impact === "HIGH");
  const riskAlerts = demoEvents
    .map(createRiskAlert)
    .filter((alert): alert is EconomicRiskAlert => Boolean(alert));

  const riskScore =
    riskAlerts.length === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            ...riskAlerts.map((alert) =>
              alert.riskLevel === "EXTREME"
                ? 90
                : alert.riskLevel === "HIGH"
                  ? 70
                  : alert.riskLevel === "ELEVATED"
                    ? 45
                    : 10
            )
          ) + Math.min(riskAlerts.length * 5, 10)
        );

  const riskLevel = getRiskLevel(riskScore);
  const tradingAction = getTradingAction(riskLevel);

  return {
    version: "V11.0.4",
    generatedAt: new Date().toISOString(),
    totalEvents: demoEvents.length,
    highImpactEvents: highImpactEvents.length,
    upcomingHighImpactEvents: highImpactEvents.filter(
      (event) => event.status === "UPCOMING"
    ),
    riskScore,
    riskLevel,
    tradingAction,
    riskAlerts,
    recommendation: buildRecommendation(riskLevel, tradingAction, riskAlerts),
    events: demoEvents,
  };
}