/**
 * Professional Trading Filters
 * Alle Filter werden VOR Execution in instrumentation.ts geprüft.
 * Jede Funktion gibt { allowed: boolean; reason: string } zurück.
 *
 * Stand 30.07.: 7 Filter aktiv — Economic Calendar, Korrelation, Tagesverlust,
 * Wochenverlust, Gesamt-Drawdown (neu), Exposure/gebundene Margin (neu),
 * Liquidität. Die beiden neuen schliessen die Lücke aus der Einstellungs-
 * Inventur: maxTotalDrawdownPct und maxExposurePct standen in der Oberfläche,
 * waren aber nirgends implementiert.
 */

import { pythonBackendAuthHeader } from "@/lib/python-backend/auth-header";

const PYTHON_BASE = () =>
  process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";

// ── Typen ─────────────────────────────────────────────────────────────────────
export interface FilterResult {
  allowed: boolean;
  reason: string;
}

export interface OpenPosition {
  symbol?: string;
  epic?: string;
  direction?: string;
}

// ── 1. Economic Calendar Filter ───────────────────────────────────────────────
// Blockiert Trades 30min vor/nach HIGH-Impact News (NFP, FOMC, CPI, etc.)
let _calendarCache: { data: Array<{ symbol: string; blocked: boolean; reason: string | null }>; ts: number } | null = null;

export async function checkEconomicCalendar(symbol: string): Promise<FilterResult> {
  const base = PYTHON_BASE();
  if (!base) return { allowed: true, reason: "" };
  try {
    const now = Date.now();
    // Cache 5min — nicht jeden Scan neu fetchen
    if (!_calendarCache || now - _calendarCache.ts > 5 * 60 * 1000) {
      _calendarCache = { data: [], ts: now };
    }
    const cached = _calendarCache.data.find(c => c.symbol === symbol);
    if (cached) {
      return cached.blocked
        ? { allowed: false, reason: `⚠️ News-Blackout: ${cached.reason}` }
        : { allowed: true, reason: "" };
    }

    const res = await fetch(`${base}/api/v1/intelligence/calendar/blackout/${symbol}?window_min=30`, {
      signal: AbortSignal.timeout(3000),
      headers: pythonBackendAuthHeader(),
    });
    if (!res.ok) return { allowed: true, reason: "" };
    const data = await res.json() as { blocked: boolean; reason: string | null };
    _calendarCache.data.push({ symbol, blocked: data.blocked, reason: data.reason });
    if (data.blocked) {
      console.log(`[filter] 📅 ${symbol} GEBLOCKT: News-Blackout — ${data.reason}`);
      return { allowed: false, reason: `News-Blackout: ${data.reason}` };
    }
    return { allowed: true, reason: "" };
  } catch {
    return { allowed: true, reason: "" }; // bei Fehler nicht blocken
  }
}

// ── 2. Correlation Filter ─────────────────────────────────────────────────────
// Verhindert dass mehrere korrelierte Positionen gleichzeitig offen sind
const CORRELATION_GROUPS: Record<string, string[]> = {
  USD_LONG:  ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD"],  // alle gegen USD
  USD_SHORT: ["USDCAD", "USDCHF", "USDJPY"],              // USD als Base
  JPY:       ["USDJPY", "EURJPY", "GBPJPY"],
  EUR:       ["EURUSD", "EURGBP", "EURJPY"],
  GBP:       ["GBPUSD", "EURGBP", "GBPJPY"],
  GOLD_SILVER: ["XAUUSD", "XAGUSD"],
  OIL:       ["USOIL", "UKOIL"],
  US_INDICES:["NAS100", "SPX500", "DJ30"],
  EU_INDICES:["GER40", "UK100"],
};
const MAX_CORRELATED = 2; // max Positionen in einer Korrelations-Gruppe

export function checkCorrelation(
  symbol: string,
  direction: "BUY" | "SELL",
  openPositions: OpenPosition[]
): FilterResult {
  const sym = symbol.toUpperCase();
  for (const [group, members] of Object.entries(CORRELATION_GROUPS)) {
    if (!members.includes(sym)) continue;
    // Zähle offene Positionen in dieser Gruppe
    const sameGroupOpen = openPositions.filter(p => {
      const ps = (p.symbol ?? p.epic ?? "").toUpperCase();
      return members.includes(ps);
    });
    if (sameGroupOpen.length >= MAX_CORRELATED) {
      console.log(`[filter] 🔗 ${sym} GEBLOCKT: Korrelation [${group}] — ${sameGroupOpen.length}/${MAX_CORRELATED} Positionen bereits offen`);
      return { allowed: false, reason: `Korrelation [${group}]: bereits ${sameGroupOpen.length} Positionen offen` };
    }
  }
  return { allowed: true, reason: "" };
}

// ── 3. Max. Tages-Verlust Limit ───────────────────────────────────────────────
// Stoppt alle Trades wenn Tagesverlust > maxDailyLossPct
const _dayStart: Record<string, number> = {}; // date → startBalance

export function checkDailyLossLimit(
  currentBalance: number,
  maxDailyLossPct: number = 3.0 // Default 3%
): FilterResult {
  const today = new Date().toISOString().slice(0, 10);
  if (!_dayStart[today]) {
    // Ersten Balance des Tages merken
    _dayStart[today] = currentBalance;
    // Gestern löschen
    for (const k of Object.keys(_dayStart)) {
      if (k !== today) delete _dayStart[k];
    }
    return { allowed: true, reason: "" };
  }
  const startBal = _dayStart[today];
  if (startBal <= 0) return { allowed: true, reason: "" };
  const lossPct = ((startBal - currentBalance) / startBal) * 100;
  if (lossPct >= maxDailyLossPct) {
    console.log(`[filter] 🛑 TAGESVERLUST LIMIT: ${lossPct.toFixed(2)}% >= ${maxDailyLossPct}% — kein weiterer Trade heute`);
    return { allowed: false, reason: `Tagesverlust-Limit erreicht: -${lossPct.toFixed(1)}% (Max: -${maxDailyLossPct}%)` };
  }
  return { allowed: true, reason: "" };
}

// ── 4. Wochen-Drawdown Guard ──────────────────────────────────────────────────
// Stoppt neue Trades wenn Wochenverlust > maxWeeklyLossPct (Redis-persistent,
// überlebt Deploys). Offene Positionen werden weiter verwaltet — nur keine neuen.

function isoWeekKey(): string {
  const d = new Date();
  // ISO-Woche: Donnerstag der aktuellen Woche bestimmt das Jahr
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function checkWeeklyLossLimit(
  currentBalance: number,
  maxWeeklyLossPct: number = 6.0
): Promise<FilterResult> {
  try {
    if (currentBalance <= 0) return { allowed: true, reason: "" };
    const { cacheGet, cacheSet } = await import("../cache/redis-cache");
    const key = `week_start_balance:${isoWeekKey()}`;
    const stored = await cacheGet<{ balance: number; alerted?: boolean }>(key);

    if (!stored) {
      // Erster Zyklus dieser Woche: Startbalance festhalten (8 Tage TTL)
      await cacheSet(key, { balance: currentBalance }, 8 * 24 * 60 * 60);
      return { allowed: true, reason: "" };
    }

    const lossPct = ((stored.balance - currentBalance) / stored.balance) * 100;
    if (lossPct >= maxWeeklyLossPct) {
      console.log(`[filter] 🛑 WOCHENVERLUST LIMIT: ${lossPct.toFixed(2)}% >= ${maxWeeklyLossPct}% — keine neuen Trades diese Woche`);
      // Telegram-Alarm nur einmal pro Woche
      if (!stored.alerted) {
        await cacheSet(key, { balance: stored.balance, alerted: true }, 8 * 24 * 60 * 60);
        try {
          const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
          await sendTelegram(
`🛑 <b>WOCHEN-DRAWDOWN-SCHUTZ AKTIV</b>

Wochenverlust: -${lossPct.toFixed(1)}% (Limit: -${maxWeeklyLossPct}%)
Wochenstart-Balance: ${stored.balance.toFixed(2)}
Aktuelle Balance: ${currentBalance.toFixed(2)}

⛔ Keine neuen Trades bis Montag.
✅ Offene Positionen werden weiter verwaltet (BE/Trail/TP).
🕐 ${new Date().toLocaleString("de-CH")}`
          );
        } catch { /* non-fatal */ }
      }
      return { allowed: false, reason: `Wochenverlust-Limit: -${lossPct.toFixed(1)}% (Max: -${maxWeeklyLossPct}%)` };
    }
    return { allowed: true, reason: "" };
  } catch {
    return { allowed: true, reason: "" }; // bei Fehler nicht blocken
  }
}

// ── 5. Liquidity / Spread Filter ─────────────────────────────────────────────
// Blockiert Trades auf illiquiden Märkten (zu großer Spread)
const MAX_SPREAD_PCT: Record<string, number> = {
  CURRENCIES:      0.003,  // max 0.3% Spread für Forex
  INDICES:         0.005,  // max 0.5% für Indizes
  COMMODITIES:     0.008,  // max 0.8% für Rohstoffe
  CRYPTOCURRENCIES:0.020,  // max 2% für Crypto
};

export function checkLiquidity(
  symbol: string,
  bid: number,
  spread: number,
  instrumentType: string
): FilterResult {
  if (bid <= 0 || spread < 0) return { allowed: true, reason: "" };
  const spreadPct = spread / bid;
  const maxPct = MAX_SPREAD_PCT[instrumentType.toUpperCase()] ?? 0.01;
  if (spreadPct > maxPct) {
    console.log(`[filter] 💧 ${symbol} GEBLOCKT: Spread ${(spreadPct * 100).toFixed(3)}% > Max ${(maxPct * 100).toFixed(1)}% — illiquide`);
    return { allowed: false, reason: `Spread zu groß: ${(spreadPct * 100).toFixed(2)}%` };
  }
  return { allowed: true, reason: "" };
}

// ── 6. Gesamt-Drawdown-Limit ─────────────────────────────────────────────────
// Generalkontroll-Fund 30.07.: maxTotalDrawdownPct stand in den Einstellungen,
// war aber NIRGENDS implementiert — es gab überhaupt keinen Gesamt-Drawdown-
// Schutz. Gemessen wird vom höchsten je gesehenen Kontostand (Peak), das ist
// die übliche Drawdown-Definition. Peak liegt in Redis, gleiches Muster wie
// week_start_balance beim Wochenlimit.
// Erster Lauf setzt den Peak auf den aktuellen Stand — dadurch kann ein
// Altbestand niemals rückwirkend alles blockieren.
export async function checkTotalDrawdownLimit(
  currentBalance: number,
  maxTotalDrawdownPct: number
): Promise<FilterResult> {
  if (currentBalance <= 0 || !maxTotalDrawdownPct || maxTotalDrawdownPct <= 0) {
    return { allowed: true, reason: "" };
  }
  try {
    const { cacheGet, cacheSet } = await import("../cache/redis-cache");
    const KEY = "peak_balance";
    const TTL = 365 * 24 * 60 * 60; // 1 Jahr
    const stored = await cacheGet<{ peak: number }>(KEY);
    const peak = stored?.peak ?? 0;

    if (currentBalance > peak) {
      await cacheSet(KEY, { peak: currentBalance }, TTL);
      return { allowed: true, reason: "" }; // neuer Höchststand = kein Drawdown
    }
    if (peak <= 0) return { allowed: true, reason: "" };

    const ddPct = ((peak - currentBalance) / peak) * 100;
    if (ddPct >= maxTotalDrawdownPct) {
      console.log(`[filter] 🛑 GESAMT-DRAWDOWN: -${ddPct.toFixed(2)}% vom Höchststand ${peak.toFixed(2)} >= ${maxTotalDrawdownPct}% — kein weiterer Trade`);
      return { allowed: false, reason: `Gesamt-Drawdown-Limit: -${ddPct.toFixed(1)}% (Max: -${maxTotalDrawdownPct}%)` };
    }
    return { allowed: true, reason: "" };
  } catch {
    return { allowed: true, reason: "" }; // Redis weg → nicht blockieren (wie Wochenlimit)
  }
}

// ── 7. Exposure-Limit (gebundene Margin) ─────────────────────────────────────
// Generalkontroll-Fund 30.07.: maxExposurePct stand in den Einstellungen, war
// aber NIRGENDS implementiert. Gerechnet wird mit den ECHTEN Broker-Werten:
// Capital.com liefert balance und available (freie Margin) — gebundene Margin
// ist die Differenz. Keine selbst erfundene Notional-Formel.
export function checkExposureLimit(
  balance: number,
  available: number,
  maxExposurePct: number
): FilterResult {
  if (!maxExposurePct || maxExposurePct <= 0) return { allowed: true, reason: "" };
  if (balance <= 0 || available <= 0 || available > balance) {
    return { allowed: true, reason: "" }; // Werte unplausibel → nicht blockieren
  }
  const usedPct = ((balance - available) / balance) * 100;
  if (usedPct >= maxExposurePct) {
    console.log(`[filter] 🛑 EXPOSURE-LIMIT: ${usedPct.toFixed(1)}% gebunden >= ${maxExposurePct}% — kein weiterer Trade`);
    return { allowed: false, reason: `Exposure-Limit: ${usedPct.toFixed(1)}% gebunden (Max: ${maxExposurePct}%)` };
  }
  return { allowed: true, reason: "" };
}

// ── 8. Kurs-Aktualität ───────────────────────────────────────────────────────
// Fund 02.08.: Der yfinance-Rückfall stempelte JEDEN Kurs mit der aktuellen
// Uhrzeit — ein 57 Stunden alter Nikkei-Kurs sah taufrisch aus. Da Einstieg,
// SL und TP auf diesem Kurs berechnet werden, hätte ein veralteter Kurs zu
// einem Einstieg auf falschem Niveau und sofort auslösendem Stop führen können.
//
// Blockiert wird NUR bei nachweislich veraltetem Kurs (minutengenauer
// Zeitstempel vorhanden UND älter als erlaubt). Ist die Genauigkeit nur
// tagesbasiert oder das Alter unbekannt, wird gewarnt statt blockiert —
// sonst würden Instrumente ohne Minutendaten (z.B. zeitweise Gold/Öl)
// grundlos vom Handel ausgeschlossen.
export function checkPriceFreshness(
  symbol: string,
  ageMinutes: number | null | undefined,
  maxAgeMinutes: number
): FilterResult {
  if (!maxAgeMinutes || maxAgeMinutes <= 0) return { allowed: true, reason: "" }; // 0 = aus
  if (ageMinutes == null) {
    console.warn(`[filter] ⏳ ${symbol}: Kurs-Alter unbekannt — nicht blockiert, aber ungeprüft`);
    return { allowed: true, reason: "" };
  }
  if (ageMinutes > maxAgeMinutes) {
    console.log(`[filter] 🛑 ${symbol} GEBLOCKT: Kurs ist ${Math.round(ageMinutes)} Min alt (max ${maxAgeMinutes}) — Markt vermutlich geschlossen`);
    return { allowed: false, reason: `Kurs veraltet: ${Math.round(ageMinutes)} Min alt (max ${maxAgeMinutes})` };
  }
  return { allowed: true, reason: "" };
}

// ── 9. Volatility Scaling ─────────────────────────────────────────────────────
// Gibt adjustierten riskPercent zurück — kleiner bei hoher ATR
export function getVolatilityAdjustedRisk(
  symbol: string,
  baseRiskPct: number,
  atr: number,
  currentPrice: number
): number {
  if (!atr || !currentPrice || currentPrice <= 0) return baseRiskPct;
  const atrPct = (atr / currentPrice) * 100; // ATR als % des Preises
  // Skalierung: normale ATR ~0.5-1.5%, hohe ATR >2%
  let multiplier = 1.0;
  if (atrPct > 3.0)      multiplier = 0.4;  // sehr hohe Vola → 40% des Risikos
  else if (atrPct > 2.0) multiplier = 0.6;
  else if (atrPct > 1.5) multiplier = 0.8;
  else if (atrPct < 0.3) multiplier = 0.7;  // zu niedrige Vola = keine Bewegung
  const adjusted = Math.max(0.1, Math.round(baseRiskPct * multiplier * 10) / 10);
  if (multiplier !== 1.0) {
    console.log(`[filter] 📊 ${symbol} Volatility-Scaling: ATR=${atrPct.toFixed(2)}% → Risk ${baseRiskPct}% → ${adjusted}%`);
  }
  return adjusted;
}

// ── Alle Filter kombiniert prüfen ─────────────────────────────────────────────
export async function runAllFilters(params: {
  symbol: string;
  direction: "BUY" | "SELL";
  bid: number;
  spread: number;
  instrumentType: string;
  currentBalance: number;
  openPositions: OpenPosition[];
  maxDailyLossPct?: number;
  /** Gesamt-Drawdown-Limit in % (Generalkontroll-Fund 30.07.). */
  maxTotalDrawdownPct?: number;
  /** Exposure-Limit in % gebundener Margin (Generalkontroll-Fund 30.07.). */
  maxExposurePct?: number;
  /** Freie Margin laut Broker — nötig für die Exposure-Prüfung. */
  availableMargin?: number;
  /** Alter des Kurses in Minuten (02.08.). null/undefined = unbekannt. */
  priceAgeMinutes?: number | null;
  /** Erlaubtes Höchstalter in Minuten. 0 = Prüfung aus. */
  maxPriceAgeMinutes?: number;
}): Promise<{ allowed: boolean; blockedBy: string; reason: string }> {
  const {
    symbol, direction, bid, spread, instrumentType, currentBalance, openPositions,
    maxDailyLossPct, maxTotalDrawdownPct, maxExposurePct, availableMargin,
    priceAgeMinutes, maxPriceAgeMinutes,
  } = params;

  // 0. Kurs-Aktualität — ZUERST: ohne verlässlichen Kurs sind alle folgenden
  //    Prüfungen (Spread, Verlustgrenzen) und die Einstiegsberechnung wertlos.
  if (maxPriceAgeMinutes != null) {
    const freshFilter = checkPriceFreshness(symbol, priceAgeMinutes, maxPriceAgeMinutes);
    if (!freshFilter.allowed) return { allowed: false, blockedBy: "PRICE_STALE", reason: freshFilter.reason };
  }

  // 1. Economic Calendar
  const calFilter = await checkEconomicCalendar(symbol);
  if (!calFilter.allowed) return { allowed: false, blockedBy: "ECONOMIC_CALENDAR", reason: calFilter.reason };

  // 2. Correlation
  const corrFilter = checkCorrelation(symbol, direction, openPositions);
  if (!corrFilter.allowed) return { allowed: false, blockedBy: "CORRELATION", reason: corrFilter.reason };

  // 3. Daily Loss
  const lossFilter = checkDailyLossLimit(currentBalance, maxDailyLossPct);
  if (!lossFilter.allowed) return { allowed: false, blockedBy: "DAILY_LOSS_LIMIT", reason: lossFilter.reason };

  // 4. Weekly Drawdown Guard
  const weeklyFilter = await checkWeeklyLossLimit(currentBalance);
  if (!weeklyFilter.allowed) return { allowed: false, blockedBy: "WEEKLY_LOSS_LIMIT", reason: weeklyFilter.reason };

  // 5. Gesamt-Drawdown (30.07.)
  if (maxTotalDrawdownPct != null) {
    const ddFilter = await checkTotalDrawdownLimit(currentBalance, maxTotalDrawdownPct);
    if (!ddFilter.allowed) return { allowed: false, blockedBy: "TOTAL_DRAWDOWN_LIMIT", reason: ddFilter.reason };
  }

  // 6. Exposure / gebundene Margin (30.07.)
  if (maxExposurePct != null && availableMargin != null) {
    const expFilter = checkExposureLimit(currentBalance, availableMargin, maxExposurePct);
    if (!expFilter.allowed) return { allowed: false, blockedBy: "EXPOSURE_LIMIT", reason: expFilter.reason };
  }

  // 7. Liquidity
  const liqFilter = checkLiquidity(symbol, bid, spread, instrumentType);
  if (!liqFilter.allowed) return { allowed: false, blockedBy: "LIQUIDITY", reason: liqFilter.reason };

  return { allowed: true, blockedBy: "", reason: "" };
}
