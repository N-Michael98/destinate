import type { NewsItem } from "./news-types";

const newsCache = new Map<string, NewsItem>();

export function setNewsCache(item: NewsItem) {
  newsCache.set(item.id, item);
}

export function getNewsCache() {
  return Array.from(newsCache.values());
}

export function clearNewsCache() {
  newsCache.clear();
}

export function getNewsCacheStatus() {
  return {
    status: "READY" as const,
    cachedItems: newsCache.size,
    message: "In-memory news cache prepared for V7.6.",
  };
}