/**
 * Professional Trading Filters
 * Alle 7 Filter werden VOR Execution in instrumentation.ts geprüft.
 * Jede Funktion gibt { allowed: boolean; reason: string } zurück.
 */

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

// ── 7. Volatility Scaling ─────────────────────────────────────────────────────
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
}): Promise<{ allowed: boolean; blockedBy: string; reason: string }> {
  const { symbol, direction, bid, spread, instrumentType, currentBalance, openPositions, maxDailyLossPct } = params;

  // 1. Economic Calendar
  const calFilter = await checkEconomicCalendar(symbol);
  if (!calFilter.allowed) return { allowed: false, blockedBy: "ECONOMIC_CALENDAR", reason: calFilter.reason };

  // 2. Correlation
  const corrFilter = checkCorrelation(symbol, direction, openPositions);
  if (!corrFilter.allowed) return { allowed: false, blockedBy: "CORRELATION", reason: corrFilter.reason };

  // 3. Daily Loss
  const lossFilter = checkDailyLossLimit(currentBalance, maxDailyLossPct);
  if (!lossFilter.allowed) return { allowed: false, blockedBy: "DAILY_LOSS_LIMIT", reason: lossFilter.reason };

  // 5. Liquidity
  const liqFilter = checkLiquidity(symbol, bid, spread, instrumentType);
  if (!liqFilter.allowed) return { allowed: false, blockedBy: "LIQUIDITY", reason: liqFilter.reason };

  return { allowed: true, blockedBy: "", reason: "" };
}
