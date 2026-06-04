import {
  NewsImpact,
  NewsIntelligenceReport,
  NewsItem,
  NewsSentiment,
} from "./news-types";

function impactToScore(impact: NewsImpact) {
  switch (impact) {
    case "CRITICAL":
      return 100;
    case "HIGH":
      return 75;
    case "MEDIUM":
      return 45;
    case "LOW":
      return 20;
    default:
      return 0;
  }
}

function calculateOverallSentiment(news: NewsItem[]): NewsSentiment {
  const riskOffCount = news.filter(
    (item) =>
      item.sentiment === "RISK_OFF" ||
      item.sentiment === "BEARISH"
  ).length;

  const riskOnCount = news.filter(
    (item) =>
      item.sentiment === "RISK_ON" ||
      item.sentiment === "BULLISH"
  ).length;

  if (riskOffCount > riskOnCount) {
    return "RISK_OFF";
  }

  if (riskOnCount > riskOffCount) {
    return "RISK_ON";
  }

  return "NEUTRAL";
}

function createMockNewsFeed(): NewsItem[] {
  const now = new Date().toISOString();

  return [
    {
      id: "news-geopolitical-risk-001",
      title: "Geopolitical risk watch active",
      category: "GEOPOLITICAL",
      impact: "MEDIUM",
      sentiment: "RISK_OFF",
      affectedMarkets: ["XAUUSD", "USOIL", "EURUSD", "NAS100"],
      source: "SYSTEM_MOCK_NEWS",
      summary:
        "Mock geopolitical layer prepared. Later this will connect to live geopolitical and world news sources.",
      timestamp: now,
    },
    {
      id: "news-central-bank-001",
      title: "Central bank policy sensitivity active",
      category: "CENTRAL_BANK",
      impact: "HIGH",
      sentiment: "NEUTRAL",
      affectedMarkets: ["EURUSD", "NAS100", "XAUUSD"],
      source: "SYSTEM_MOCK_NEWS",
      summary:
        "Mock central bank layer prepared. Later this will track Fed, ECB, BoE and major rate decisions.",
      timestamp: now,
    },
    {
      id: "news-commodities-001",
      title: "Commodity supply risk monitor prepared",
      category: "COMMODITIES",
      impact: "MEDIUM",
      sentiment: "RISK_OFF",
      affectedMarkets: ["USOIL", "XAUUSD"],
      source: "SYSTEM_MOCK_NEWS",
      summary:
        "Mock commodity news layer prepared for oil supply, OPEC, inventories and safe-haven gold reactions.",
      timestamp: now,
    },
  ];
}

export class NewsIntelligenceEngine {
  static analyze(): NewsIntelligenceReport {
    const news = createMockNewsFeed();

    const highImpactNews = news.filter(
      (item) =>
        item.impact === "HIGH" ||
        item.impact === "CRITICAL"
    );

    const geopoliticalItems = news.filter(
      (item) => item.category === "GEOPOLITICAL"
    );

    const macroItems = news.filter(
      (item) =>
        item.category === "MACRO" ||
        item.category === "CENTRAL_BANK"
    );

    const geopoliticalRiskScore =
      geopoliticalItems.length > 0
        ? Math.max(
            ...geopoliticalItems.map((item) =>
              impactToScore(item.impact)
            )
          )
        : 0;

    const macroRiskScore =
      macroItems.length > 0
        ? Math.max(
            ...macroItems.map((item) =>
              impactToScore(item.impact)
            )
          )
        : 0;

    const marketRiskScore = Math.round(
      news.reduce(
        (sum, item) => sum + impactToScore(item.impact),
        0
      ) / Math.max(news.length, 1)
    );

    const affectedMarkets = Array.from(
      new Set(
        news.flatMap((item) => item.affectedMarkets)
      )
    );

    const overallSentiment =
      calculateOverallSentiment(news);

    const geopoliticalRisk: NewsImpact =
      geopoliticalRiskScore >= 75
        ? "HIGH"
        : geopoliticalRiskScore >= 45
          ? "MEDIUM"
          : "LOW";

    const macroRisk: NewsImpact =
      macroRiskScore >= 75
        ? "HIGH"
        : macroRiskScore >= 45
          ? "MEDIUM"
          : "LOW";

    const recommendation =
      marketRiskScore >= 75
        ? "High news risk detected. Reduce risk and require stronger confirmation before paper trades."
        : marketRiskScore >= 45
          ? "Medium news risk detected. Keep strategy selection active but avoid overconfidence."
          : "Low news risk detected. Normal strategy selection can continue.";

    return {
      version: "V11.0.0",
      totalNews: news.length,
      highImpactNews: highImpactNews.length,
      geopoliticalRisk,
      macroRisk,
      overallSentiment,
      marketRiskScore,
      affectedMarkets,
      recommendation,
      news,
      updatedAt: new Date().toISOString(),
    };
  }
}