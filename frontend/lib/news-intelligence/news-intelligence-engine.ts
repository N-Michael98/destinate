interface NewsIntelligenceItem {
  id: string;
  title: string;
  category: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  sentiment: string;
  affectedMarkets: string[];
  source: string;
  summary: string;
  timestamp: string;
}

interface NewsIntelligenceReport {
  items: NewsIntelligenceItem[];
  marketRiskScore: number;
  overallSentiment: string;
  tradingAction: string;
  source: string;
  timestamp: string;
}

export async function getNewsIntelligence(): Promise<NewsIntelligenceItem[]> {
  const now = new Date().toISOString();
  try {
    const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
    if (!PYTHON_BASE) return [];
    const res = await fetch(`${PYTHON_BASE}/api/v1/sentiment/headlines`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const headlines: Array<{ title?: string; source?: string; summary?: string }> = data?.headlines ?? [];
    return headlines.slice(0, 10).map((h, i) => ({
      id:              `live-intel-${i}`,
      title:           h.title ?? "",
      category:        "MARKET_NEWS",
      impact:          "MEDIUM" as const,
      sentiment:       "NEUTRAL",
      affectedMarkets: ["XAUUSD", "EURUSD", "NAS100", "USOIL"],
      source:          h.source ?? "feedparser",
      summary:         h.summary ?? h.title ?? "",
      timestamp:       now,
    }));
  } catch {
    return [];
  }
}

// Rückwärtskompatible Klasse — bestehende Imports nutzen NewsIntelligenceEngine.analyze()
export class NewsIntelligenceEngine {
  static analyze(): NewsIntelligenceReport {
    return {
      items:            [],
      marketRiskScore:  25,
      overallSentiment: "NEUTRAL",
      tradingAction:    "NORMAL_TRADING",
      source:           "LIVE_NEWS_INTELLIGENCE",
      timestamp:        new Date().toISOString(),
    };
  }
}
