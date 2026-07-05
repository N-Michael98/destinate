/**
 * Applied Overrides Store (Stufe 1, Teil B/C)
 *
 * Speichert welche Analysis-Engine-Vorschläge der Admin per Telegram
 * /apply bestätigt hat. NUR bestätigte Overrides beeinflussen Trades.
 * Alles fallback-sicher: Fehler → keine Overrides → Trading unverändert.
 */

import { cacheGet, cacheSet } from "../cache/redis-cache";

const KEY_APPLIED = "analysis:applied_overrides";
const KEY_RECOMMENDATIONS = "analysis:recommendations";
const TTL_APPLIED = 30 * 24 * 60 * 60; // 30 Tage — danach muss neu bestätigt werden

export interface SymbolOverride {
  style: "SCALPING" | "DAYTRADING" | "SWING";
  strategy?: string;
  slPct?: number; // z.B. 0.01 = SL bei 1% vom Einstiegspreis
  tpPct?: number;
  appliedAt: string;
  appliedBy: string;
}

export interface Recommendation {
  symbol: string;
  reason: string;
  suggestion: { style: string; strategy?: string; slPct?: number; tpPct?: number };
  evidence: string;
  status: string;
}

export async function getRecommendations(): Promise<Recommendation[]> {
  try {
    const data = await cacheGet<{ recommendations?: Recommendation[] }>(KEY_RECOMMENDATIONS);
    return data?.recommendations ?? [];
  } catch {
    return [];
  }
}

export async function getAppliedOverrides(): Promise<Record<string, SymbolOverride>> {
  try {
    return (await cacheGet<Record<string, SymbolOverride>>(KEY_APPLIED)) ?? {};
  } catch {
    return {};
  }
}

export async function applyOverride(symbol: string, appliedBy: string): Promise<SymbolOverride | null> {
  const recs = await getRecommendations();
  const rec = recs.find(r => r.symbol.toUpperCase() === symbol.toUpperCase());
  if (!rec) return null;

  const override: SymbolOverride = {
    style: (rec.suggestion.style ?? "DAYTRADING") as SymbolOverride["style"],
    strategy: rec.suggestion.strategy,
    slPct: rec.suggestion.slPct,
    tpPct: rec.suggestion.tpPct,
    appliedAt: new Date().toISOString(),
    appliedBy,
  };
  const all = await getAppliedOverrides();
  all[rec.symbol.toUpperCase()] = override;
  await cacheSet(KEY_APPLIED, all, TTL_APPLIED);
  return override;
}

export async function unapplyOverride(symbol: string): Promise<boolean> {
  const all = await getAppliedOverrides();
  const key = symbol.toUpperCase();
  if (!all[key]) return false;
  delete all[key];
  await cacheSet(KEY_APPLIED, all, TTL_APPLIED);
  return true;
}
