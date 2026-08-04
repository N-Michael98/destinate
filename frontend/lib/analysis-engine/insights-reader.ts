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

// ── Walk-Forward-Robustheit (04.08.) ─────────────────────────────────────────
//
// Der Walk-Forward optimiert auf einem Abschnitt der Historie und misst auf dem
// FOLGENDEN, ungesehenen. Bricht ein Markt dabei ein, war der gute In-Sample-Wert
// blosse Kurvenanpassung. Bis heute landeten diese Ergebnisse ausschliesslich im
// Telegram-Bericht (periodic_report.py:139) — kein Handelspfad hat sie je gelesen.
//
// Gelesen wird aus demselben Redis, das der analysis-engine beschreibt; es
// braucht weder einen zusätzlichen Schlüssel noch einen HTTP-Aufruf. Fällt Redis
// oder die Engine aus, kommt null zurück und der Handel läuft unverändert weiter.

const REDIS_KEY_WALKFORWARD = "analysis:walkforward";
// Der Walk-Forward läuft nicht täglich. Sieben Tage sind grosszügig genug, dass
// ein Ergebnis nicht vorschnell verfällt, und eng genug, dass niemand auf Monate
// alten Zahlen handelt.
const WF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface WalkforwardRobustheit {
  robust: string[];
  ueberangepasst: string[];
  standVom: string;
  alterTage: number;
}

export async function getWalkforwardRobustheit(): Promise<WalkforwardRobustheit | null> {
  try {
    const data = await cacheGet<{
      status?: string;
      updatedAt?: string;
      robustSymbols?: string[];
      overfitWarningSymbols?: string[];
    }>(REDIS_KEY_WALKFORWARD);
    // Nur ein abgeschlossener Lauf zählt — "running" oder "error" liefern nichts.
    if (!data || data.status !== "done" || !data.updatedAt) return null;
    const alter = Date.now() - new Date(data.updatedAt).getTime();
    if (!Number.isFinite(alter) || alter > WF_MAX_AGE_MS) return null;
    return {
      robust: data.robustSymbols ?? [],
      ueberangepasst: data.overfitWarningSymbols ?? [],
      standVom: data.updatedAt,
      alterTage: Math.round((alter / 86400000) * 10) / 10,
    };
  } catch {
    return null;
  }
}
