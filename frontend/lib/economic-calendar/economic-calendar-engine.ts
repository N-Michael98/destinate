import {
  EconomicCalendarReport,
  EconomicEvent,
} from "./economic-calendar-types";

const demoEvents: EconomicEvent[] = [
  {
    id: "us-cpi",
    title: "US CPI Inflation Rate",
    country: "United States",
    currency: "USD",
    impact: "HIGH",
    status: "UPCOMING",
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
    previous: "3.4%",
    forecast: "3.2%",
    category: "Inflation",
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

export function generateEconomicCalendarReport(): EconomicCalendarReport {
  const highImpactEvents = demoEvents.filter((event) => event.impact === "HIGH");

  return {
    version: "V11.0.2",
    generatedAt: new Date().toISOString(),
    totalEvents: demoEvents.length,
    highImpactEvents: highImpactEvents.length,
    upcomingHighImpactEvents: highImpactEvents.filter(
      (event) => event.status === "UPCOMING"
    ),
    events: demoEvents,
  };
}