import { getMockNewsFeed, getNewsProviderStatus } from "./news-provider";
import { setNewsCache, getNewsCacheStatus } from "./news-cache";
import { getMockMacroCalendar } from "./economic-calendar";
import { calculateMockSentiment } from "./sentiment-engine";

export async function refreshIntelligenceResources() {
  const providerStatus = await getNewsProviderStatus();
  const news = await getMockNewsFeed();

  news.forEach((item) => setNewsCache(item));

  const macroCalendar = getMockMacroCalendar();
  const sentiment = calculateMockSentiment(news);

  return {
    providerStatus,
    news,
    macroCalendar,
    sentiment,
    cacheStatus: getNewsCacheStatus(),
  };
}

export function getIntelligenceForwardLearningPlan() {
  return {
    purpose:
      "Connect news, macro events, sentiment and analysis sources to future forward testing and AI learning memory.",
    futureSources: [
      "Yahoo Finance",
      "Capital.com analysis/news",
      "TradingView technical context",
      "Economic calendar",
      "Professional news sources",
    ],
    futureLearningOutputs: [
      "News impact ranking",
      "Macro event risk rules",
      "Strategy filters by market regime",
      "AI memory updates",
      "Forward testing improvement reports",
    ],
  };
}