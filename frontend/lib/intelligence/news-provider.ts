import type { NewsItem } from "./news-types";

export async function getMockNewsFeed(): Promise<NewsItem[]> {
  const publishedAt = new Date().toISOString();

  return [
    {
      id: "mock-news-001",
      title: "US dollar remains key driver before macro data",
      summary:
        "Mock intelligence item for USD-sensitive markets like NAS100, XAUUSD and EURUSD.",
      symbols: ["NAS100", "XAUUSD", "EURUSD"],
      source: "MOCK",
      impact: "MEDIUM",
      sentiment: "NEUTRAL",
      publishedAt,
    },
    {
      id: "mock-news-002",
      title: "Oil traders monitor inventory and geopolitical risk",
      summary:
        "Mock intelligence item for crude oil market behavior and future forward testing.",
      symbols: ["USOIL"],
      source: "MOCK",
      impact: "HIGH",
      sentiment: "NEUTRAL",
      publishedAt,
    },
  ];
}

export async function getNewsProviderStatus() {
  return {
    provider: "MockNewsProvider",
    status: "PREPARED" as const,
    message:
      "News provider layer prepared. Yahoo Finance, Capital.com, TradingView and professional sources can be connected later.",
  };
}