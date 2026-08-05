// Real GPT + Claude analysis engine — uses stored API keys + Python Backend TA data
import { getAISettings } from "../ai-config/ai-config-store";
import type { CapitalMarket } from "../capital-com/capital-com-client";
import { pythonBackendAuthHeader } from "../python-backend/auth-header";

export interface GPTMarketAnalysis {
  symbol: string;
  epic: string;
  direction: "BUY" | "SELL" | "WAIT";
  confidence: number;
  reasoning: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  tradingStyle: "SCALPING" | "DAYTRADING" | "SWING";
  /** MEASURED_CONSENSUS (04.08.): Richtung stammt nicht von GPT, sondern aus
   *  der Einigkeit von TA-Lib, Strategie-Konsens und Entry-Quality. */
  source: "GPT_REAL" | "GPT_SIMULATED" | "MEASURED_CONSENSUS";
}

export interface ClaudeRiskAssessment {
  symbol: string;
  approved: boolean;
  riskScore: number;
  maxRiskPercent: number;
  reasoning: string;
  rewardRiskRatio: number;
  source: "CLAUDE_REAL" | "CLAUDE_SIMULATED";
}

export interface ScannerOpportunity {
  rank: number;
  epic: string;
  symbol: string;
  instrumentName: string;
  instrumentType?: string;
  bid: number;
  ask: number;
  spread: number;
  /** Alter des zugrundeliegenden Kurses in Minuten (02.08.). null = unbekannt.
   *  Broker-Kurse sind live, yfinance-Rückfallkurse können Stunden alt sein. */
  ageMinutes?: number | null;
  gpt: GPTMarketAnalysis;
  claude: ClaudeRiskAssessment;
  finalScore: number;
  goSignal: boolean;
  taSignals?: { atr?: number; rsi?: number; trend?: string; signal?: string };
  // Entry-Engine Phase D (26.07.): Qualitäts-Tier pro Chance (für Reporting)
  entryQualityTier?: string;
  entryQualityScore?: number;
  analysisQuality?: {
    hasGPT: boolean;
    hasTALib: boolean;
    hasStrategies: boolean;
    pythonBackendOk: boolean;
    isRealAnalysis: boolean;
    taLibSymbolCount: number;
    strategySymbolCount: number;
  };
}

// ── Python Backend TA-Lib Analyse holen ───────────────────────────────────────
interface TAlibSummary {
  symbol: string;
  trend: string;
  rsi: number;
  macd_signal: string;
  signal: string; // STRONG_BUY / BUY / NEUTRAL / SELL / STRONG_SELL
  score: number;
  ema_20: number;
  ema_50: number;
  atr: number;
  // ── Schritt 1 (26.07.): zusätzliche Felder vom Backend (alle optional,
  // damit ein älterer Backend-Stand nichts bricht) ──────────────────────────
  bb_upper?: number | null;      // dynamische Resistance-Zone
  bb_middle?: number | null;
  bb_lower?: number | null;      // dynamische Support-Zone
  bb_width?: number | null;      // Bandbreite in % — für Regime-Detection
  adx?: number | null;           // Trendstärke (>25 = starker Trend)
  ema_200?: number | null;       // Haupttrend-Linie
  above_ema200?: boolean | null;
  patterns_bullish?: string[];
  patterns_bearish?: string[];
}

async function fetchTALibData(symbols: string[]): Promise<Map<string, TAlibSummary>> {
  const result = new Map<string, TAlibSummary>();
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (!PYTHON_BASE) return result;
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/talib/analyze/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
      body: JSON.stringify({ symbols, interval: "1d" }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.warn(`[ai-engine] TA-Lib Backend Fehler: ${res.status} ${res.statusText}`);
      return result;
    }
    const data = await res.json() as { results?: Record<string, TAlibSummary> };
    const received = Object.keys(data.results ?? {}).length;
    console.log(`[ai-engine] TA-Lib: ${received}/${symbols.length} Symbole analysiert`);
    for (const [sym, ta] of Object.entries(data.results ?? {})) {
      result.set(sym, ta);
    }
    // Fehlende Symbole loggen
    const missing = symbols.filter(s => !result.has(s));
    if (missing.length > 0) console.warn(`[ai-engine] TA-Lib fehlend (kein yfinance-Mapping?): ${missing.join(", ")}`);
  } catch (e) { console.warn("[ai-engine] TA-Lib fetch fehlgeschlagen:", e); }
  return result;
}

// ── Strategy Signale vom Python Backend holen ─────────────────────────────────
interface StrategySignal {
  signal:     "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  reasoning:  string;
}
interface StrategyResult {
  symbol:          string;
  consensus:       "LONG" | "SHORT" | "NEUTRAL";
  consensus_conf:  number;
  long_votes:      number;
  short_votes:     number;
  neutral_votes:   number;
  total_strategies:number;
  active:          Array<{ strategy: string; signal: string; confidence: number; reasoning: string }>;
  // Schritt 2 (26.07.): explizite S/R-Zonen (optional — älteres Backend ok)
  levels?: {
    support: number;
    resistance: number;
    price: number;
    atr: number;
    dist_to_resistance_atr: number | null;
    dist_to_support_atr: number | null;
  } | null;
  // Entry-Engine Phase B (26.07.): aggregierter Einstiegs-Qualitätsscore
  entry_quality?: {
    score: number;                                    // 0-100
    tier: "EXCELLENT" | "GOOD" | "MODERATE" | "WEAK" | "NO_SIGNAL";
    direction: "LONG" | "SHORT" | "NEUTRAL";
    reasons: string[];
  } | null;
}

async function fetchStrategySignals(symbols: string[]): Promise<Map<string, StrategyResult>> {
  const result = new Map<string, StrategyResult>();
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (!PYTHON_BASE) return result;
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/strategies/analyze/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
      body: JSON.stringify({ symbols }),
      // 60s (27.07. erhöht): 23 Symbole x bis zu 7 einzigartige yfinance-Fetches
      // (nach Dedup-Fix in _load()) über 8 Worker-Threads, plus Backend-seitige
      // Retries (bis +3s je Call bei transienten yfinance-Hängern) — 25s war
      // zu knapp, führte zu wiederkehrenden Timeouts trotz Event-Loop- und
      // Cache-Fix. Backend selbst kann nie unendlich hängen (Circuit-Breaker +
      // max. 3 Retry-Versuche), daher ist ein grosszügigeres Client-Timeout sicher.
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.warn(`[ai-engine] Strategies Backend Fehler: ${res.status} ${res.statusText}`);
      return result;
    }
    const data = await res.json() as { results?: Record<string, StrategyResult> };
    const received = Object.keys(data.results ?? {}).length;
    console.log(`[ai-engine] Strategies: ${received}/${symbols.length} Symbole analysiert`);
    for (const [sym, sr] of Object.entries(data.results ?? {})) {
      result.set(sym, sr);
    }
  } catch (e) { console.warn("[ai-engine] Strategies fetch fehlgeschlagen:", e); }
  return result;
}

// ── Real OpenAI API call ───────────────────────────────────────────────────────
async function callGPT(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 4000, // Urteil für ALLE ~22 Märkte (Testphase) ≈ 2500-3500 Tokens Output
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[ai-engine] ⛔ GPT HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json() as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }>;
    return choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn(`[ai-engine] ⛔ GPT Call fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// ── Real Anthropic API call ────────────────────────────────────────────────────
async function callClaude(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[ai-engine] ⛔ Claude HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json() as Record<string, unknown>;
    const content = data.content as Array<{ text: string }>;
    return content?.[0]?.text ?? null;
  } catch (e) {
    console.warn(`[ai-engine] ⛔ Claude Call fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch { return fallback; }
}

// ── Fallback wenn kein GPT Key — WAIT statt Zufalls-Trade ────────────────────
function noSignal(market: CapitalMarket): GPTMarketAnalysis {
  return {
    symbol: market.symbol, epic: market.epic,
    direction: "WAIT",
    confidence: 0,
    reasoning: "No OpenAI API key configured — no trade signal generated.",
    entry: market.ask,
    stopLoss: 0,
    takeProfit: 0,
    tradingStyle: "DAYTRADING",
    source: "GPT_SIMULATED",
  };
}

/**
 * Chance-Risiko-Verhältnis am TATSÄCHLICHEN Einstiegskurs.
 *
 * KORREKTUR 04.08.: Gerechnet wurde bisher mit `gpt.entry` — einer Zahl, die
 * das Modell selbst nennt und die nichts kosten muss. Die Order läuft aber zum
 * echten Marktpreis (orchestrator-agent.ts: ask bei BUY, bid bei SELL).
 *
 * Belegt am Fall EUR/JPY vom 04.08. 21:41: GPT meldete SELL mit Stop 182.5 und
 * Ziel 180.5 und kam durch die Prüfung. Damit R/R >= 1.5 herauskommt, muss der
 * genannte Einstieg bei mindestens 181.70 gelegen haben — der Markt stand aber
 * bei 180.64. Am echten Einstieg ergibt sich ein Verhältnis von 0.075, also ein
 * ZWANZIGFACH schlechteres als geprüft wurde. Ziel 0.15 Punkte entfernt, Stop
 * 1.85 Punkte.
 *
 * Jetzt entscheidet der Kurs, zu dem wirklich gekauft oder verkauft wird.
 */
function realesChanceRisiko(
  gpt: GPTMarketAnalysis,
  markt: { bid: number; ask: number },
): number {
  if (gpt.direction === "WAIT" || !(gpt.stopLoss > 0) || !(gpt.takeProfit > 0)) return 0;
  const einstieg = gpt.direction === "BUY" ? (markt.ask || markt.bid) : (markt.bid || markt.ask);
  if (!(einstieg > 0)) return 0;
  const risiko = Math.abs(einstieg - gpt.stopLoss);
  const chance = Math.abs(gpt.takeProfit - einstieg);
  if (!(risiko > 0)) return 0;
  // Stop auf der falschen Seite des Einstiegs -> unbrauchbares Setup.
  const stopFalsch = gpt.direction === "BUY" ? gpt.stopLoss >= einstieg : gpt.stopLoss <= einstieg;
  const zielFalsch = gpt.direction === "BUY" ? gpt.takeProfit <= einstieg : gpt.takeProfit >= einstieg;
  if (stopFalsch || zielFalsch) return 0;
  return chance / risiko;
}

function simulateClaude(gpt: GPTMarketAnalysis, markt: { bid: number; ask: number }): ClaudeRiskAssessment {
  const rrRatio = realesChanceRisiko(gpt, markt);
  const riskScore = Math.max(10, 80 - gpt.confidence);
  return {
    symbol: gpt.symbol,
    approved: gpt.direction !== "WAIT" && gpt.confidence >= 70 && rrRatio >= 1.5,
    riskScore,
    maxRiskPercent: riskScore > 60 ? 0.5 : 1.0,
    reasoning: `Risk assessment: confidence=${gpt.confidence}% R/R=${rrRatio.toFixed(2)}`,
    rewardRiskRatio: rrRatio,
    source: "CLAUDE_REAL",
  };
}

// ── Feature 4: Strategy Performance Feedback ─────────────────────────────────
// Cached — wird alle 30min vom Python Backtest neu geholt
let _stratPerfCache: { data: string; ts: number } | null = null;

async function fetchStrategyPerformance(): Promise<string> {
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (!PYTHON_BASE) return "";
  const now = Date.now();
  if (_stratPerfCache && now - _stratPerfCache.ts < 30 * 60 * 1000) return _stratPerfCache.data;
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
      body: JSON.stringify({ symbol: "EURUSD", interval: "1h", period: "1mo", strategy: "multi", initial_balance: 10000 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const d = await res.json() as Record<string, unknown>;
    const wr = d.win_rate ? `${Number(d.win_rate).toFixed(0)}%` : "n/a";
    const pf = d.profit_factor ? `PF=${Number(d.profit_factor).toFixed(2)}` : "";
    const sr = d.sharpe_ratio ? `Sharpe=${Number(d.sharpe_ratio).toFixed(2)}` : "";
    const summary = `Recent backtest (EURUSD 1mo): WinRate=${wr} ${pf} ${sr}`.trim();
    _stratPerfCache = { data: summary, ts: now };
    return summary;
  } catch { return ""; }
}

// ── Feature 6: Multi-Timeframe TA-Lib ────────────────────────────────────────
async function fetchMultiTimeframeSummary(symbols: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (!PYTHON_BASE || !symbols.length) return result;
  try {
    // 1H und 4H parallel zu 1D (1D schon in fetchTALibData)
    // yfinance VALID_INTERVALS: 1h, 1d, 1wk — "4h" nicht unterstützt → "1wk" stattdessen
    const [r1h, r1wk] = await Promise.all([
      fetch(`${PYTHON_BASE}/api/v1/talib/analyze/multi`, {
        method: "POST", headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
        body: JSON.stringify({ symbols, interval: "1h" }),
        signal: AbortSignal.timeout(25000),
      }).then(r => r.ok ? r.json() as Promise<{ results?: Record<string, { trend: string; signal: string }> }> : null).catch(() => null),
      fetch(`${PYTHON_BASE}/api/v1/talib/analyze/multi`, {
        method: "POST", headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
        body: JSON.stringify({ symbols, interval: "1wk" }),
        signal: AbortSignal.timeout(25000),
      }).then(r => r.ok ? r.json() as Promise<{ results?: Record<string, { trend: string; signal: string }> }> : null).catch(() => null),
    ]);
    for (const sym of symbols) {
      const t1h = r1h?.results?.[sym];
      const t1wk = r1wk?.results?.[sym];
      if (t1h || t1wk) {
        result.set(sym, `1H:${t1h?.trend ?? "?"}/${t1h?.signal ?? "?"} 1W:${t1wk?.trend ?? "?"}/${t1wk?.signal ?? "?"}`);
      }
    }
  } catch { /* non-fatal */ }
  return result;
}

// ── Regime-Detection (Woche 2, 26.07.) ───────────────────────────────────────
// Nutzt AUSSCHLIESSLICH bereits vorhandene, echte TA-Werte (adx, bb_width) —
// keine Neuberechnung, kein Platzhalter (siehe alte lib/market-regime/* die
// immer "TRENDING, confidence 86" zurückgab — bewusst NICHT wiederverwendet).
export type MarketRegimeType = "TRENDING" | "RANGING" | "VOLATILE" | "UNKNOWN";

export interface MarketRegimeInfo {
  regime: MarketRegimeType;
  reason: string;
}

export function detectMarketRegime(ta?: TAlibSummary | null): MarketRegimeInfo {
  const adx = ta?.adx;
  const bbWidth = ta?.bb_width;
  if (adx == null && bbWidth == null) {
    return { regime: "UNKNOWN", reason: "keine ADX/BB-Daten" };
  }
  // Hohe Bollinger-Breite = Ausdehnung/Volatilitäts-Schub (unabhängig vom Trend)
  if (bbWidth != null && bbWidth > 4.0) {
    return { regime: "VOLATILE", reason: `bb_width=${bbWidth.toFixed(1)}% (Ausdehnung)` };
  }
  // ADX > 25 = klassische Trendstärke-Schwelle (Wilder)
  if (adx != null && adx >= 25) {
    return { regime: "TRENDING", reason: `adx=${adx.toFixed(0)}` };
  }
  // ADX < 20 + enge Bollinger-Bänder = Konsolidierung/Range
  if (adx != null && adx < 20) {
    return { regime: "RANGING", reason: `adx=${adx.toFixed(0)}${bbWidth != null ? `, bb_width=${bbWidth.toFixed(1)}%` : ""}` };
  }
  return { regime: "UNKNOWN", reason: `adx=${adx?.toFixed(0) ?? "?"} (Übergangszone 20-25)` };
}

// Strategien, die auf klare Trends angewiesen sind — im RANGING-Regime schwach
const TREND_FOLLOWING_STRATEGIES = new Set(["trend_following", "breakout", "ma_crossover", "donchian", "momentum"]);
// Strategien, die von Seitwärtsbewegung profitieren — im RANGING-Regime stark
const MEAN_REVERSION_STRATEGIES = new Set(["mean_reversion", "support_resistance", "rsi_divergence", "bb_squeeze", "scalping"]);

/** Passt die Confidence einer Top-Strategie ans erkannte Regime an (additiv,
 * kappt nur — erhöht nie über die Original-Confidence hinaus). */
export function regimeAdjustedNote(regime: MarketRegimeType, topStrategyName?: string): string {
  if (regime === "RANGING" && topStrategyName && TREND_FOLLOWING_STRATEGIES.has(topStrategyName)) {
    return "RANGING-Markt + Trendfolge-Strategie — historisch schwach, Vorsicht";
  }
  if (regime === "RANGING" && topStrategyName && MEAN_REVERSION_STRATEGIES.has(topStrategyName)) {
    return "RANGING-Markt + Mean-Reversion-Strategie — passt zueinander";
  }
  if (regime === "VOLATILE") {
    return "Volatilitäts-Ausdehnung — engere Positionsgrösse/weitere Stops erwägen";
  }
  return "";
}

// ── Main Analyse ───────────────────────────────────────────────────────────────
export async function analyzeMarkets(markets: CapitalMarket[]): Promise<ScannerOpportunity[]> {
  const ai = await getAISettings();
  const hasGPT = ai.openai.connected && ai.openai.apiKey.length > 20;
  const hasClaude = ai.anthropic.connected && ai.anthropic.apiKey.length > 20;

  // Kosten-Guard: Dieser Scanner läuft alle 5 Min — teure Modelle aus der
  // UI-Config werden für Routine-Scans auf die günstigen Pendants gemappt.
  // (gpt-4o ≈ 6× teurer als mini; Sonnet ≈ 3× teurer als Haiku)
  const CHEAP_GPT: Record<string, string> = { "gpt-4o": "gpt-4o-mini", "gpt-4-turbo": "gpt-4o-mini" };
  const CHEAP_CLAUDE: Record<string, string> = {
    "claude-sonnet-4-6": "claude-haiku-4-5-20251001",
    "claude-opus-4-8": "claude-haiku-4-5-20251001",
  };
  // KORREKTUR 03.08.: Diese Umschaltung war BEDINGUNGSLOS — wer in der UI
  // gpt-4o wählte, bekam für den Scan trotzdem immer gpt-4o-mini. Die
  // Modellwahl war für den Scanner damit wirkungslos, ohne dass es irgendwo
  // abschaltbar war. Jetzt entscheidet die Einstellung botSettings
  // .useFullModelsForScan; Standard false = unverändertes bisheriges Verhalten.
  let sparen = true;
  // Gemessener Konsens (04.08.) — standardmässig AUS, siehe Erklärung unten.
  let messkonsensAktiv = false;
  try {
    const { getSettings } = await import("../settings/settings-store");
    const st = await getSettings();
    sparen = !st.botSettings?.useFullModelsForScan;
    messkonsensAktiv = st.botSettings?.allowMeasuredConsensus === true;
  } catch { /* Einstellungen nicht lesbar → sparen, kein Messkonsens */ }
  const scanGptModel = sparen ? (CHEAP_GPT[ai.openai.model] ?? ai.openai.model) : ai.openai.model;
  const scanClaudeModel = sparen ? (CHEAP_CLAUDE[ai.anthropic.model] ?? ai.anthropic.model) : ai.anthropic.model;
  if (scanGptModel !== ai.openai.model || scanClaudeModel !== ai.anthropic.model) {
    console.log(`[ai-engine] 💰 Kosten-Guard: Scan nutzt ${scanGptModel} / ${scanClaudeModel} (Config: ${ai.openai.model} / ${ai.anthropic.model})`);
  } else {
    console.log(`[ai-engine] 🎯 Scan nutzt die konfigurierten Modelle: ${scanGptModel} / ${scanClaudeModel}`);
  }

  const validMarkets = markets.filter((m) => m.bid > 0).slice(0, 30);

  // ── TA-Lib (1D) + Strategy Signale + Multi-TF + Strategy Performance parallel
  const symbols = validMarkets.map(m => m.symbol).filter(Boolean);
  const [taData, strategyData, mtfData, stratPerfSummary] = await Promise.all([
    fetchTALibData(symbols),
    fetchStrategySignals(symbols),
    fetchMultiTimeframeSummary(symbols),
    fetchStrategyPerformance(),
  ]);

  // ── Sicherheits-Check: GPT + TA-Lib müssen beide verfügbar sein ──────────
  // Kein GPT-Key → kein Trade. TA-Lib nicht geantwortet → kein Trade.
  const taPct = symbols.length > 0 ? taData.size / symbols.length : 0;
  const pythonBackendOk = taData.size > 0 && taPct >= 0.5; // mind. 50% der Symbole analysiert
  if (!hasGPT) {
    console.warn("[ai-engine] ⛔ Kein GPT-Key — kein Trade möglich. Analyse wird fortgesetzt aber goSignal=false für alle.");
  }
  if (!pythonBackendOk) {
    console.warn(`[ai-engine] ⛔ Python Backend nicht erreichbar oder zu wenige TA-Lib Daten (${taData.size}/${symbols.length}) — kein Trade möglich.`);
  }

  // ── GPT Batch Analyse mit echten TA-Daten ────────────────────────────────
  let gptBatchResult: Record<string, Partial<GPTMarketAnalysis>> = {};

  if (hasGPT && validMarkets.length > 0) {
    // Marktliste mit TA-Lib Daten anreichern
    const marketList = validMarkets.map((m) => {
      const ta = taData.get(m.symbol);
      const sr = strategyData.get(m.symbol);
      const mtf = mtfData.get(m.symbol);
      const taInfo = ta
        ? ` | 1D:trend=${ta.trend} rsi=${ta.rsi?.toFixed(0)} macd=${ta.macd_signal} signal=${ta.signal} ema20=${ta.ema_20?.toFixed(2)} ema50=${ta.ema_50?.toFixed(2)} atr=${ta.atr?.toFixed(2)}`
        : "";
      // Schritt 3 (26.07.): Bollinger (dynamische S/R), ADX (Trendstärke),
      // EMA200 (Haupttrend), Candlestick-Patterns — bisher nie an GPT gegeben
      const extraTa = ta
        ? [
            ta.bb_upper != null && ta.bb_lower != null ? `bb=[${Number(ta.bb_lower).toFixed(2)}..${Number(ta.bb_upper).toFixed(2)}]` : "",
            ta.adx != null ? `adx=${Number(ta.adx).toFixed(0)}` : "",
            ta.ema_200 != null ? `ema200=${Number(ta.ema_200).toFixed(2)}${ta.above_ema200 === true ? "(price>ema200)" : ta.above_ema200 === false ? "(price<ema200)" : ""}` : "",
            (ta.patterns_bullish?.length ?? 0) > 0 ? `bullPat=${ta.patterns_bullish!.slice(0, 2).join(",")}` : "",
            (ta.patterns_bearish?.length ?? 0) > 0 ? `bearPat=${ta.patterns_bearish!.slice(0, 2).join(",")}` : "",
          ].filter(Boolean).join(" ")
        : "";
      const extraInfo = extraTa ? ` | ${extraTa}` : "";
      // Regime-Detection (Woche 2, 26.07.): TRENDING/RANGING/VOLATILE aus
      // echten ADX/BB-Werten — kein Platzhalter, nutzt bereits vorhandene Daten
      const regimeInfo = detectMarketRegime(ta);
      const regimeText = regimeInfo.regime !== "UNKNOWN" ? ` | regime=${regimeInfo.regime}(${regimeInfo.reason})` : "";
      // Schritt 3: konkrete S/R-Zonen + Abstand in ATR (Kernstück gegen
      // Einstiege direkt an der Zone)
      const lv = sr?.levels;
      const srZones = lv
        ? ` | SR: support=${lv.support} resistance=${lv.resistance} distToRes=${lv.dist_to_resistance_atr ?? "?"}ATR distToSup=${lv.dist_to_support_atr ?? "?"}ATR`
        : "";
      // Phase C (26.07.): Entry Quality Score in den Prompt
      const eq = sr?.entry_quality;
      const eqInfo = eq && eq.tier !== "NO_SIGNAL"
        ? ` | entryQuality=${eq.score}/100(${eq.tier},${eq.direction})`
        : "";
      const mtfInfo = mtf ? ` | ${mtf}` : "";
      // Schritt 3: ALLE aktiven Strategien (vorher nur Top-1 auf 80 Zeichen)
      const stInfo = sr && sr.consensus !== "NEUTRAL"
        ? ` | strategies=${sr.consensus}(${sr.consensus_conf}%) [${sr.long_votes}L/${sr.short_votes}S/${sr.neutral_votes}N of ${sr.total_strategies}] active: ${
            (sr.active ?? []).slice(0, 6).map(a => `${a.strategy}=${a.signal}(${a.confidence})`).join(", ")
          }`
        : sr ? ` | strategies=NEUTRAL(${sr.neutral_votes}/${sr.total_strategies} neutral)` : "";
      return `${m.epic} (${m.instrumentName}): bid=${m.bid} ask=${m.ask} spread=${m.spread}${taInfo}${extraInfo}${regimeText}${srZones}${eqInfo}${mtfInfo}${stInfo}`;
    }).join("\n");

    const stratPerfLine = stratPerfSummary ? `\nSystem performance context: ${stratPerfSummary}` : "";

    // News-Sentiment aus der Analysis Engine (Redis) — komplett fail-safe:
    // Fehler/leer → newsBlock bleibt "" und der Prompt ist exakt wie bisher.
    let newsBlock = "";
    try {
      const { cacheGet } = await import("../cache/redis-cache");
      const news = await cacheGet<{
        centralBanks?: Record<string, { source?: string; sentiment?: { label?: string } | null }>;
        geopolitics?: Array<{ topic: string; articleCount: number; affects: string[]; sentiment?: { label?: string } | null }>;
      }>("analysis:news");
      if (news) {
        const lines: string[] = [];
        for (const [cur, cb] of Object.entries(news.centralBanks ?? {})) {
          const label = cb?.sentiment?.label;
          if (label && label !== "neutral") lines.push(`${cur} central-bank news sentiment: ${label} (${cb.source})`);
        }
        for (const g of news.geopolitics ?? []) {
          if ((g.articleCount ?? 0) > 0) {
            lines.push(`Geopolitics "${g.topic}": ${g.articleCount} articles, sentiment=${g.sentiment?.label ?? "?"} — affects ${g.affects.join(", ")}`);
          }
        }
        if (lines.length > 0) {
          newsBlock = `\n\nCURRENT NEWS & GEOPOLITICAL CONTEXT (risk overlay — reduce confidence or prefer WAIT on negatively affected symbols):\n${lines.slice(0, 10).join("\n")}`;
        }
      }
    } catch { /* non-fatal — Prompt ohne News wie bisher */ }

    const prompt = `You are a professional forex and CFD trading analyst with 20 years of experience.${stratPerfLine}${newsBlock}

Analyze these live markets with REAL technical indicator data from TA-Lib (1D + 1H + 4H multi-timeframe). Return a judgment for EVERY market listed — use direction "WAIT" (confidence 0, stopLoss 0, takeProfit 0) when there is no clean setup. Do NOT skip any market:

${marketList}

CALIBRATION: WAIT is for genuinely unclear situations, not a safe default. If a
market satisfies its direction rules, name that direction with an honest
confidence — even a moderate one. Your judgment is not the last gate: every
direction you name still has to clear a separate risk review, a confidence
threshold, a minimum reward/risk ratio and several independent filters before
anything is traded. Answering WAIT for every market is itself a bad analysis,
because it means none of the available information was used.

CRITICAL RULES — violations = bad analysis:
- ONLY recommend BUY if 1D trend=BULLISH OR signal=BUY/STRONG_BUY. If trend=BEARISH → SELL or WAIT.
- ONLY recommend SELL if 1D trend=BEARISH OR signal=SELL/STRONG_SELL. If trend=BULLISH → BUY or WAIT.
- MULTI-TIMEFRAME: if 1H and 1W (weekly) both confirm 1D direction → increase
  confidence +10. If they disagree, that is the normal case, not a stop: reduce
  confidence by 15 and still name the 1D direction. Do NOT answer WAIT merely
  because timeframes conflict — the confidence penalty already expresses the
  doubt, and a setup that ends up below the threshold is filtered out anyway.
  Reserve WAIT for when the 1D direction itself is unclear.
- RSI > 70 = overbought → prefer SELL or WAIT for BUY setups
- RSI < 30 = oversold → prefer BUY or WAIT for SELL setups
- If signal=NEUTRAL and RSI 40-60 → WAIT
- If strategies=LONG with >60% confidence AND trend=BULLISH → strong BUY signal
- If strategies=SHORT with >60% confidence AND trend=BEARISH → strong SELL signal
- If strategies and trend DISAGREE → reduce confidence by 15 or go WAIT
- SUPPORT/RESISTANCE (highest priority — overrides trend signals):
  * distToRes and distToSup are numbers measured IN ATR UNITS. Compare them
    numerically. A value of 1.76 or 2.33 is NOT "near" — the rules below apply
    ONLY when the number is strictly below 1.0. If distToRes >= 1.0 there is
    room to the upside and this rule must not block anything. Same for
    distToSup >= 1.0 on the downside. Do not describe a distance above 1.0 ATR
    as "near".
  * distToRes < 1.0 ATR → price is AT resistance → NO BUY. If the 1D trend is
    ALSO bearish, this is a textbook SELL setup — take the SELL rather than
    WAIT, unless something else clearly contradicts it.
  * distToSup < 1.0 ATR → price is AT support → NO SELL. If the 1D trend is
    ALSO bullish, this is a textbook BUY setup — take the BUY rather than
    WAIT, unless something else clearly contradicts it.
  * Never buy into resistance or sell into support just because the trend agrees.
  * Also treat the Bollinger band edges (bb=[lower..upper]) as dynamic zones.
- ADX < 20 = weak/ranging trend → trend-following setups are unreliable, prefer
  range logic (buy support / sell resistance) or WAIT.
- REGIME (regime=TRENDING/RANGING/VOLATILE): in RANGING, prefer mean-reversion
  entries (bounce off support/resistance) over breakout/trend-following setups.
  In VOLATILE, widen stops or reduce confidence — false breakouts are common.
- EMA200: only take BUY when price > ema200, SELL when price < ema200, unless a
  clear reversal pattern (bullPat/bearPat) confirms otherwise.
- ENTRY QUALITY (entryQuality=score/100): this aggregates strategy consensus,
  market structure/BOS, S/R context and confidence. Only tier WEAK, or a tier
  that actively disagrees with your direction, is a reason to reduce confidence
  by 15. MODERATE on its own is NOT a reason to WAIT — it is the normal case.
  Prefer setups where entryQuality is GOOD or EXCELLENT and agrees with your
  direction, but do not require it.
- Minimum R:R ratio 1.5 — if no clean setup → WAIT
- ENTRY: the order fills at the CURRENT market price, not at a level you pick.
  Set "entry" to the quoted ask for BUY and to the quoted bid for SELL — both
  are given per market above. Never invent a better entry that the market has
  not reached. Stop and target must make sense FROM THAT PRICE: measured from
  it, the distance to the target must be at least 1.5× the distance to the stop.
  If that is not achievable at the current price, answer WAIT — a setup that
  only works at a price we cannot get is not a setup.
- stopLoss MUST be below entry for BUY, above entry for SELL
- Place stopLoss beyond the relevant S/R zone, not inside it
- Max SL distances: GOLD=15pts, EURUSD=0.0040, NAS100=200pts, USOIL=2.0, BTCUSD=1000

Return ONLY valid JSON. BUY and SELL are equally valid outcomes — decide purely from
each market's own data, never from habit or from these examples' direction:
{
  "opportunities": [
    {
      "epic": "GOLD",
      "symbol": "XAUUSD",
      "direction": "BUY",
      "confidence": 78,
      "reasoning": "Trend bullish, RSI 52, MACD bullish crossover, price above EMA20 and EMA50",
      "entry": 2340.5,
      "stopLoss": 2328.0,
      "takeProfit": 2365.0,
      "tradingStyle": "DAYTRADING"
    },
    {
      "epic": "US100",
      "symbol": "NAS100",
      "direction": "SELL",
      "confidence": 74,
      "reasoning": "Trend bearish, RSI 68, MACD bearish crossover, price below EMA20 and EMA50",
      "entry": 19850.0,
      "stopLoss": 19920.0,
      "takeProfit": 19700.0,
      "tradingStyle": "DAYTRADING"
    }
  ]
}`;

    let raw = await callGPT(ai.openai.apiKey, scanGptModel, prompt);
    // Sicherheitsnetz: Wenn das günstige Modell im OpenAI-Projekt gesperrt ist
    // (403 model access), einmal mit dem konfigurierten Modell nachversuchen —
    // eine Modell-Sperre darf nie die komplette Analyse schwärzen.
    if (raw === null && scanGptModel !== ai.openai.model) {
      console.warn(`[ai-engine] ↩️ Fallback auf Config-Modell ${ai.openai.model} (${scanGptModel} nicht verfügbar?)`);
      raw = await callGPT(ai.openai.apiKey, ai.openai.model, prompt);
    }
    const parsed = parseJSON<{ opportunities: Array<Partial<GPTMarketAnalysis>> }>(raw, { opportunities: [] });
    for (const opp of parsed.opportunities ?? []) {
      if (opp.epic) gptBatchResult[opp.epic] = opp;
    }
    console.log(`[ai-engine] GPT-Batch: ${raw ? `Antwort ${raw.length} Zeichen` : "KEINE ANTWORT (Call fehlgeschlagen)"} → ${Object.keys(gptBatchResult).length} Opportunities`);

    // WARUM sagt GPT "WAIT"? (03.08.) Der Trichter zeigt seit heute, DASS alle
    // 30 Märkte an dieser Stelle ausscheiden — nicht aber, an welcher der zwölf
    // WAIT-Regeln im Prompt. Ohne diese Information wäre jede Prompt-Änderung
    // geraten, und der Prompt entscheidet über echtes Geld.
    // GPT liefert zu jedem Markt eine Begründung; hier werden die der
    // WAIT-Entscheidungen ausgegeben. Reine Ausgabe, ändert nichts.
    const alle = Object.values(gptBatchResult);
    const warten = alle.filter((o) => o.direction === "WAIT");
    if (alle.length > 0) {
      const richtungen = alle.reduce<Record<string, number>>((acc, o) => {
        const d = String(o.direction ?? "?");
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      }, {});
      console.log(
        `[ai-engine] 🧭 GPT-Richtungen: ${Object.entries(richtungen).map(([d, n]) => `${d}=${n}`).join(" ")}`
      );
      for (const o of warten.slice(0, 5)) {
        console.log(`[ai-engine] 🧭 WAIT ${o.symbol ?? o.epic}: ${String(o.reasoning ?? "(ohne Begründung)").slice(0, 180)}`);
      }
      // Falls GPT doch eine Richtung nennt: mit welcher Confidence scheitert sie?
      for (const o of alle.filter((x) => x.direction && x.direction !== "WAIT").slice(0, 5)) {
        console.log(`[ai-engine] 🧭 ${o.direction} ${o.symbol ?? o.epic}: conf=${o.confidence ?? "?"} sl=${o.stopLoss ?? "?"} tp=${o.takeProfit ?? "?"} — ${String(o.reasoning ?? "").slice(0, 120)}`);
      }
    }
  }

  // ── Jedes Symbol verarbeiten ──────────────────────────────────────────────
  const opportunities: ScannerOpportunity[] = [];
  // Zähler für den Signal-Trichter — siehe Erklärung bei der Auswertung unten.
  const trichter = { gesamt: 0, echteAnalyse: 0, volleDaten: 0, richtung: 0, confidence: 0, slTp: 0, go: 0 };
  // Trichter des gemessenen Konsenses (05.08.): Er löste im ersten Betriebstag
  // kein einziges Mal aus, und an welcher der vier Bedingungen es scheitert,
  // war nicht erkennbar. Rein zählend, beeinflusst nichts.
  const konsens = { gptWait: 0, taStark: 0, strategienEinig: 0, qualitaetEinig: 0 };

  for (const market of validMarkets) {
    const ta = taData.get(market.symbol);

    // GPT Signal
    let gpt: GPTMarketAnalysis;
    const gptData = gptBatchResult[market.epic];

    if (hasGPT && gptData?.direction) {
      gpt = {
        symbol: market.symbol, epic: market.epic,
        direction: gptData.direction as GPTMarketAnalysis["direction"],
        confidence: gptData.confidence ?? 60,
        reasoning: gptData.reasoning ?? "",
        entry: gptData.entry ?? market.ask,
        stopLoss: gptData.stopLoss ?? 0,
        takeProfit: gptData.takeProfit ?? 0,
        tradingStyle: (gptData.tradingStyle ?? "DAYTRADING") as GPTMarketAnalysis["tradingStyle"],
        source: "GPT_REAL",
      };
    } else if (hasGPT) {
      // GPT hat dieses Symbol trotz Anweisung nicht beantwortet → sicherer WAIT
      gpt = { ...noSignal(market), source: "GPT_REAL" };
    } else if (ta && ta.signal !== "NEUTRAL") {
      // Kein GPT → TA-Lib Signal direkt als Fallback nutzen
      const dir: "BUY" | "SELL" | "WAIT" =
        ta.signal === "STRONG_BUY" || ta.signal === "BUY" ? "BUY" :
        ta.signal === "STRONG_SELL" || ta.signal === "SELL" ? "SELL" : "WAIT";
      const slRange = ta.atr > 0 ? ta.atr * 1.5 : market.bid * 0.005;
      gpt = {
        symbol: market.symbol, epic: market.epic,
        direction: dir,
        confidence: ta.signal.includes("STRONG") ? 68 : 62,
        reasoning: `TA-Lib: trend=${ta.trend} rsi=${ta.rsi?.toFixed(0)} signal=${ta.signal}`,
        entry: market.ask,
        stopLoss: dir === "BUY" ? market.bid - slRange : market.ask + slRange,
        takeProfit: dir === "BUY" ? market.ask + slRange * 2 : market.bid - slRange * 2,
        tradingStyle: "DAYTRADING",
        source: "GPT_SIMULATED",
      };
    } else {
      // Kein GPT, kein klares TA-Signal → WAIT (kein Zufalls-Trade mehr)
      gpt = noSignal(market);
    }

    // ── Gemessener Konsens (04.08.) ──────────────────────────────────────────
    // Bis heute galt: sagt GPT "WAIT", ist der Markt erledigt — unabhängig
    // davon, was TA-Lib, die sechzehn Strategien und die Entry-Quality messen.
    // Diese Messwerte gingen zwar in den Prompt, waren dort aber blosser Text,
    // den das Modell verwerfen durfte. Der einzige Code-Weg, der eine Richtung
    // direkt aus TA-Lib ableitet (oben), setzt source="GPT_SIMULATED" und kann
    // wegen isRealAnalysis nie zu einem Trade führen.
    //
    // Entscheidung des Nutzers 04.08.: die Messung darf übernehmen — aber nur
    // bei Einigkeit ALLER drei Quellen und nur, wenn GPT nicht widerspricht.
    // Standardmässig ausgeschaltet; alle sieben nachgelagerten Tore gelten
    // unverändert weiter (echtes Chance-Risiko, Confidence-Schwelle, Meta-AI,
    // Auto-Approve, Filterkette, Broker-Stops, Grössen-Klemme).
    if (gpt.direction === "WAIT" && ta && ta.atr > 0) {
      const sr = strategyData.get(market.symbol);
      const eq = sr?.entry_quality;
      const richtung: "BUY" | "SELL" | null =
        ta.signal === "STRONG_BUY" ? "BUY" : ta.signal === "STRONG_SELL" ? "SELL" : null;
      const alsStrategie = richtung === "BUY" ? "LONG" : "SHORT";

      // Mitzählen, unabhängig davon ob die Einstellung an ist — sonst weiss
      // niemand, ob sich das Einschalten überhaupt lohnen würde.
      konsens.gptWait++;
      if (richtung !== null) konsens.taStark++;
      if (richtung !== null && sr?.consensus === alsStrategie && sr.consensus_conf >= 70) konsens.strategienEinig++;

      const einig =
        richtung !== null &&                                   // 1. TA-Lib STRONG
        sr?.consensus === alsStrategie && sr.consensus_conf >= 70 &&  // 2. Strategien einig
        eq?.direction === alsStrategie &&                      // 3. Entry-Quality einig
        (eq.tier === "GOOD" || eq.tier === "EXCELLENT");

      if (einig) konsens.qualitaetEinig++;
      if (messkonsensAktiv && einig && richtung) {
        // Stop und Ziel aus dem ATR — dieselbe Berechnung wie im bestehenden
        // TA-Lib-Rückfall. Abstand 1.5x ATR zum Stop, 3x zum Ziel: das ergibt
        // ein Chance-Risiko von 2.0 und besteht die 1.5er-Hürde von selbst.
        const slRange = ta.atr * 1.5;
        // Confidence bewusst als schwächstes Glied, nicht als Mittelwert —
        // sie muss die Schwellen des Nutzers aus eigener Kraft schaffen.
        const conf = Math.round(Math.min(sr!.consensus_conf, eq!.score));
        gpt = {
          symbol: market.symbol, epic: market.epic,
          direction: richtung,
          confidence: conf,
          reasoning: `Gemessener Konsens: TA-Lib ${ta.signal}, Strategien ${sr!.consensus} (${sr!.consensus_conf}), Entry-Quality ${eq!.tier} ${eq!.score} — GPT sagte WAIT`,
          entry: richtung === "BUY" ? market.ask : market.bid,
          stopLoss: richtung === "BUY" ? market.ask - slRange : market.bid + slRange,
          takeProfit: richtung === "BUY" ? market.ask + slRange * 2 : market.bid - slRange * 2,
          tradingStyle: "DAYTRADING",
          source: "MEASURED_CONSENSUS",
        };
        console.log(`[ai-engine] 🧮 ${market.symbol}: gemessener Konsens ${richtung} conf=${conf} — TA=${ta.signal}, Strategien=${sr!.consensus}(${sr!.consensus_conf}), EQ=${eq!.tier}(${eq!.score})`);
      }
    }

    // ── Veto-Prüfung (Schritt 4, 26.07.) ────────────────────────────────────
    // Vorher mussten VIER Bedingungen gleichzeitig zutreffen (ta.trend UND
    // ta.signal UND Strategie-Konsens UND conf>=60) — das griff praktisch nie.
    // Jetzt: zwei unabhängige Vetos, jedes für sich ausreichend.
    if (gpt.direction !== "WAIT") {
      const sr = strategyData.get(market.symbol);
      let blockReason = "";

      // Veto 1: Strategie-Mehrheit klar gegen die GPT-Richtung (>=60% Konsens)
      const stratSell = sr && sr.consensus === "SHORT" && sr.consensus_conf >= 60;
      const stratBuy  = sr && sr.consensus === "LONG"  && sr.consensus_conf >= 60;
      if (gpt.direction === "BUY" && stratSell) {
        blockReason = `Strategie-Konsens SHORT (${sr!.consensus_conf}%, ${sr!.short_votes}/${sr!.total_strategies}) gegen GPT-BUY`;
      } else if (gpt.direction === "SELL" && stratBuy) {
        blockReason = `Strategie-Konsens LONG (${sr!.consensus_conf}%, ${sr!.long_votes}/${sr!.total_strategies}) gegen GPT-SELL`;
      }

      // Veto 2 (hart): Einstieg direkt in eine S/R-Zone hinein — genau der
      // Fall aus dem UK100-Beispiel (LONG an der Resistance). Erst Breakout
      // bzw. Rejection + Retest abwarten.
      const lv = sr?.levels;
      if (!blockReason && lv) {
        const dr = lv.dist_to_resistance_atr;
        const ds = lv.dist_to_support_atr;
        if (gpt.direction === "BUY" && dr != null && dr >= 0 && dr < 1.0) {
          blockReason = `Preis klebt an Resistance ${lv.resistance} (${dr} ATR) — BUY erst nach Breakout+Retest`;
        } else if (gpt.direction === "SELL" && ds != null && ds >= 0 && ds < 1.0) {
          blockReason = `Preis klebt an Support ${lv.support} (${ds} ATR) — SELL erst nach Breakdown+Retest`;
        }
      }

      // Veto 3 (Entry-Engine Phase C): Entry Quality zeigt klar in die
      // Gegenrichtung UND hat solide Qualität (GOOD+) → blocken.
      const eq = sr?.entry_quality;
      // KORREKTUR 30.07.: hier stand "SELL" statt "SHORT". entry_quality.direction
      // kommt aus dem Backend-Konsens und ist IMMER "LONG"/"SHORT"/"NEUTRAL"
      // (trading_strategies.py:1108, im TS-Typ Zeile 138 auch so deklariert).
      // Der Vergleich "SHORT" !== "SELL" war damit bei JEDEM Verkaufssignal wahr —
      // die Entry-Quality galt als Gegenrichtung, obwohl sie zustimmte, und
      // Veto 3 hat den Trade blockiert. Einseitig gegen SHORT: bei BUY
      // funktionierte "LONG" === "LONG" korrekt.
      const gptDir = gpt.direction === "BUY" ? "LONG" : "SHORT";
      if (!blockReason && eq && (eq.tier === "GOOD" || eq.tier === "EXCELLENT")
          && eq.direction !== "NEUTRAL" && eq.direction !== gptDir) {
        blockReason = `Entry-Quality ${eq.score}/100 (${eq.tier}) zeigt ${eq.direction}, GPT will ${gpt.direction}`;
      }

      if (blockReason) {
        console.log(`[ai-engine] 🛑 ${market.symbol} ${gpt.direction} blockiert: ${blockReason}`);
        gpt = {
          ...gpt,
          direction: "WAIT",
          confidence: 0,
          reasoning: `Signal blockiert: ${blockReason}`,
        };
      }
    }

    // Claude Risk Assessment
    let claude: ClaudeRiskAssessment;
    if (hasClaude && gpt.direction !== "WAIT" && gpt.stopLoss > 0) {
      // Am ECHTEN Einstiegskurs gerechnet, nicht an GPTs genannter Zahl —
      // siehe realesChanceRisiko(). Claude bekommt denselben Wert zu sehen.
      const rrRatio = realesChanceRisiko(gpt, market);
      const taContext = ta ? `\nTA-Lib confirms: trend=${ta.trend} rsi=${ta.rsi?.toFixed(0)} signal=${ta.signal}` : "";
      const prompt = `You are a professional risk manager for a forex/CFD trading firm.

Assess this trade setup:
- Instrument: ${market.instrumentName} (${market.epic})
- Direction: ${gpt.direction}
- Current bid/ask: ${market.bid} / ${market.ask}
- Actual entry (this is where the order fills): ${gpt.direction === "BUY" ? market.ask : market.bid}
- Stop Loss: ${gpt.stopLoss} | Take Profit: ${gpt.takeProfit}
- GPT Confidence: ${gpt.confidence}%
- R/R Ratio: ${rrRatio.toFixed(2)}
- Trading Style: ${gpt.tradingStyle}${taContext}

Return ONLY valid JSON:
{
  "approved": true,
  "riskScore": 35,
  "maxRiskPercent": 1.0,
  "reasoning": "Brief assessment",
  "rewardRiskRatio": ${rrRatio.toFixed(2)}
}

Rules: approved=true only if riskScore < 60 AND rewardRiskRatio >= 1.5`;

      const raw = await callClaude(ai.anthropic.apiKey, scanClaudeModel, prompt);
      const parsed = parseJSON<Partial<ClaudeRiskAssessment>>(raw, {});
      const riskScore = parsed.riskScore ?? 50;
      const parsedRR = parsed.rewardRiskRatio ?? rrRatio;
      claude = {
        symbol: market.symbol,
        approved: riskScore < 60 && parsedRR >= 1.5,
        riskScore,
        maxRiskPercent: parsed.maxRiskPercent ?? 1.0,
        reasoning: parsed.reasoning ?? "",
        rewardRiskRatio: parsedRR,
        source: "CLAUDE_REAL",
      };
    } else {
      claude = simulateClaude(gpt, market);
    }

    // Entry-Engine Phase C: kleiner Bonus/Malus aus Entry Quality, wenn sie mit
    // der Handelsrichtung übereinstimmt (max ±8 Punkte — GPT bleibt Haupttreiber)
    const eqScore = (() => {
      const eq = strategyData.get(market.symbol)?.entry_quality;
      if (!eq || eq.direction === "NEUTRAL" || gpt.direction === "WAIT") return 0;
      // KORREKTUR 30.07.: siehe Veto 3 oben — "SELL" statt "SHORT" verglichen.
      // Folge hier: JEDES Verkaufssignal bekam -4 statt des Bonus (+8/+5/+2),
      // also bis zu 12 Punkte Nachteil im finalScore gegenüber einem Kaufsignal.
      const gptDir = gpt.direction === "BUY" ? "LONG" : "SHORT";
      if (eq.direction !== gptDir) return -4;                 // leichte Gegenrichtung
      return eq.tier === "EXCELLENT" ? 8 : eq.tier === "GOOD" ? 5 : eq.tier === "MODERATE" ? 2 : 0;
    })();

    const finalScore = gpt.direction === "WAIT" ? 0 :
      (gpt.confidence * 0.5 + (100 - claude.riskScore) * 0.3 + (claude.approved ? 20 : 0) + eqScore);

    // goSignal: NUR wenn GPT-Key aktiv + Python Backend geantwortet hat + echte Analyse
    // GPT_SIMULATED = TA-Lib Fallback ohne GPT → kein Trade
    // GPT_REAL ohne TA-Lib-Daten (pythonBackendOk=false) → kein Trade
    const isRealAnalysis = (gpt.source === "GPT_REAL" || gpt.source === "MEASURED_CONSENSUS")
      && hasGPT && pythonBackendOk;

    // Qualitäts-Gate: DIESES Symbol braucht vollständige Daten (TA-Lib UND
    // Strategie-Konsens). Fehlt eine Ebene (Timeout, yfinance-Lücke), wird
    // das Symbol in diesem Zyklus nicht gehandelt — statt still mit halber
    // Analyse. Nächster Zyklus (5 Min) versucht es automatisch neu.
    const hasFullData = !!ta && strategyData.has(market.symbol);
    if (!hasFullData && isRealAnalysis && gpt.direction !== "WAIT") {
      console.log(`[ai-engine] 🔒 ${market.symbol}: unvollständige Analyse (TA=${!!ta}, Strategien=${strategyData.has(market.symbol)}) — kein goSignal diesen Zyklus`);
    }

    const goSignal = isRealAnalysis
      && hasFullData
      && claude.approved
      && gpt.confidence >= 70
      && gpt.direction !== "WAIT"
      && gpt.stopLoss > 0
      && gpt.takeProfit > 0;

    // Trichter mitzählen (03.08.). Anlass: seit dem 30.06. entstand genau EIN
    // Trade, und das Log meldet nur das Ergebnis ("30 WAIT") — an welcher der
    // sieben Bedingungen die Märkte scheitern, war nicht erkennbar. Derselbe
    // blinde Fleck wie heute früh bei den Capital-Epics: der Ausfall ist still.
    // Reine Zählung, beeinflusst keine Entscheidung.
    trichter.gesamt++;
    if (isRealAnalysis) trichter.echteAnalyse++;
    if (isRealAnalysis && hasFullData) trichter.volleDaten++;
    if (isRealAnalysis && hasFullData && gpt.direction !== "WAIT") trichter.richtung++;
    if (isRealAnalysis && hasFullData && gpt.direction !== "WAIT" && gpt.confidence >= 70) trichter.confidence++;
    if (isRealAnalysis && hasFullData && gpt.direction !== "WAIT" && gpt.confidence >= 70 && gpt.stopLoss > 0 && gpt.takeProfit > 0) trichter.slTp++;
    if (goSignal) trichter.go++;

    const taEntry = taData.get(market.symbol);
    opportunities.push({
      rank: 0,
      epic: market.epic,
      symbol: market.symbol,
      instrumentName: market.instrumentName,
      instrumentType: (market as { instrumentType?: string }).instrumentType,
      bid: market.bid,
      ask: market.ask,
      spread: market.spread,
      ageMinutes: (market as { ageMinutes?: number | null }).ageMinutes ?? null,
      gpt,
      claude,
      finalScore,
      goSignal,
      taSignals: taEntry ? { atr: taEntry.atr, rsi: taEntry.rsi, trend: taEntry.trend, signal: taEntry.signal } : undefined,
      entryQualityTier: strategyData.get(market.symbol)?.entry_quality?.tier,
      entryQualityScore: strategyData.get(market.symbol)?.entry_quality?.score,
      // Diagnose-Felder: zeigen warum goSignal false ist
      analysisQuality: {
        hasGPT,
        hasTALib: taData.has(market.symbol),
        hasStrategies: strategyData.has(market.symbol),
        pythonBackendOk,
        isRealAnalysis,
        taLibSymbolCount: taData.size,
        strategySymbolCount: strategyData.size,
      },
    });
  }

  // Wo bleiben die Signale? Eine Zeile pro Zyklus, damit ein Engpass sofort
  // sichtbar ist statt nur das Endergebnis. Gelesen von links nach rechts:
  // jede Zahl ist die Menge, die BIS DAHIN alle Bedingungen erfüllt hat.
  console.log(
    `[ai-engine] 📊 Trichter: ${trichter.gesamt} Märkte → echte Analyse ${trichter.echteAnalyse}` +
    ` → volle Daten ${trichter.volleDaten} → Richtung≠WAIT ${trichter.richtung}` +
    ` → Confidence≥70 ${trichter.confidence} → SL/TP gesetzt ${trichter.slTp}` +
    ` → Risiko-Freigabe (R/R≥1.5) ${trichter.go} = GO`
  );
  console.log(
    `[ai-engine] 🧮 Konsens-Trichter: ${konsens.gptWait} mit GPT-WAIT → TA-Lib STRONG ${konsens.taStark}` +
    ` → Strategien einig≥70 ${konsens.strategienEinig} → Entry-Quality GOOD/EXCELLENT ${konsens.qualitaetEinig}` +
    ` = handelbar (Regler ist ${messkonsensAktiv ? "AN" : "AUS"})`
  );

  return opportunities
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}
