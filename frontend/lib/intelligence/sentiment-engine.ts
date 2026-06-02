import type { NewsItem, NewsSentiment } from "./news-types";

export type SentimentScore = {
  symbol: string;
  sentiment: NewsSentiment;
  score: number;
  reason: string;
};

export function calculateMockSentiment(news: NewsItem[]): SentimentScore[] {
  const symbols = new Set(news.flatMap((item) => item.symbols));

  return Array.from(symbols).map((symbol) => {
    const related = news.filter((item) => item.symbols.includes(symbol));
    const positive = related.filter((item) => item.sentiment === "POSITIVE").length;
    const negative = related.filter((item) => item.sentiment === "NEGATIVE").length;

    const score = 50 + positive * 10 - negative * 10;

    return {
      symbol,
      sentiment: score > 55 ? "POSITIVE" : score < 45 ? "NEGATIVE" : "NEUTRAL",
      score,
      reason:
        "Mock sentiment score prepared for future AI intelligence and forward testing.",
    };
  });
}