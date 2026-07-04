/**
 * Analysis Engine Insights Reader
 *
 * Liest die täglichen Empfehlungen der Analysis Engine (generous-creation)
 * aus Redis. Rein additiv: Fällt die Engine oder Redis aus, liefert alles
 * hier null und das Trading läuft exakt wie ohne Insights weiter.
 */

import { cacheGet } from "../cache/redis-cache";

const REDIS_KEY = "analysis:insights";
const MAX_AGE_MS = 30 * 60 * 60 * 1000; // 30h — älter gilt als stale

export interface SymbolInsight {
  score?: number;       // 0-100 Handels-Qualität (AI)
  diagnosis?: string;
  fix?: string;
}

export interface AnalysisInsights {
  updatedAt: string;
  ai?: {
    symbolInsights?: Record<string, SymbolInsight>;
    topActions?: string[];
    newsWarnings?: string[];
    summary?: string;
  } | null;
  forwardTest?: Array<{
    symbol: string;
    liveWinRate?: number | null;
    livePnl?: number;
    backtestStrategy?: string | null;
    backtestWinRate?: number | null;
  }>;
}

export async function getAnalysisInsights(): Promise<AnalysisInsights | null> {
  try {
    const data = await cacheGet<AnalysisInsights>(REDIS_KEY);
    if (!data?.updatedAt) return null;
    if (Date.now() - new Date(data.updatedAt).getTime() > MAX_AGE_MS) return null; // stale
    return data;
  } catch {
    return null;
  }
}

/**
 * Score für ein Symbol (0-100) oder null wenn keine AI-Bewertung vorliegt.
 * Philosophie: Nur EXTREM schlechte Scores (<30) blocken einen Trade —
 * schwache Märkte werden diagnostiziert und verbessert, nicht gemieden.
 */
export function getSymbolScore(insights: AnalysisInsights | null, symbol: string): number | null {
  const s = insights?.ai?.symbolInsights?.[symbol]?.score;
  return typeof s === "number" ? s : null;
}
