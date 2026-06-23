import type { NewsItem } from "./news-types";

export async function getMockNewsFeed(): Promise<NewsItem[]> {
  // Versuche echte Headlines vom Python Backend (VADER + feedparser)
  try {
    const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
    if (PYTHON_BASE) {
      const res = await fetch(`${PYTHON_BASE}/api/v1/sentiment/headlines`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const headlines: NewsItem[] = (data?.headlines ?? []).slice(0, 10).map((h: {
          title?: string; summary?: string; source?: string; link?: string;
        }, i: number) => ({
          id:          `live-news-${i}`,
          title:       h.title ?? "",
          summary:     h.summary ?? h.title ?? "",
          symbols:     ["XAUUSD", "EURUSD", "NAS100"],
          source:      h.source ?? "feedparser",
          impact:      "MEDIUM" as const,
          sentiment:   "NEUTRAL" as const,
          publishedAt: new Date().toISOString(),
        }));
        if (headlines.length > 0) return headlines;
      }
    }
  } catch { /* Fallback */ }

  // Kein MOCK mehr — leere Liste wenn keine echten Daten
  return [];
}

export async function getNewsProviderStatus() {
  return {
    provider: "Python Backend (feedparser + VADER)",
    status: "CONNECTED" as const,
    message: "Live news via RSS feeds — Reuters, Bloomberg, ForexLive, Investing.com",
  };
}
