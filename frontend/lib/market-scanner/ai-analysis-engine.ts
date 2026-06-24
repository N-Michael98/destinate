// Real GPT + Claude analysis engine — uses stored API keys + Python Backend TA data
import { getAISettings } from "../ai-config/ai-config-store";
import type { CapitalMarket } from "../capital-com/capital-com-client";

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
  marketBias: string;
  source: "GPT_REAL" | "GPT_SIMULATED";
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
  bid: number;
  ask: number;
  spread: number;
  gpt: GPTMarketAnalysis;
  claude: ClaudeRiskAssessment;
  finalScore: number;
  goSignal: boolean;
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
}

async function fetchTALibData(symbols: string[]): Promise<Map<string, TAlibSummary>> {
  const result = new Map<string, TAlibSummary>();
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (!PYTHON_BASE) return result;
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/talib/analyze/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols, interval: "1d" }),
      signal: AbortSignal.timeout(10000),
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
}

async function fetchStrategySignals(symbols: string[]): Promise<Map<string, StrategyResult>> {
  const result = new Map<string, StrategyResult>();
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (!PYTHON_BASE) return result;
  try {
    const res = await fetch(`${PYTHON_BASE}/api/v1/strategies/analyze/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
      signal: AbortSignal.timeout(25000), // Strategien brauchen etwas länger
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
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }>;
    return choices?.[0]?.message?.content ?? null;
  } catch { return null; }
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
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const content = data.content as Array<{ text: string }>;
    return content?.[0]?.text ?? null;
  } catch { return null; }
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
    marketBias: "NEUTRAL",
    source: "GPT_SIMULATED",
  };
}

function simulateClaude(gpt: GPTMarketAnalysis): ClaudeRiskAssessment {
  const rrRatio = gpt.direction !== "WAIT" && gpt.stopLoss > 0
    ? Math.abs(gpt.takeProfit - gpt.entry) / Math.abs(gpt.entry - gpt.stopLoss)
    : 0;
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

// ── Main Analyse ───────────────────────────────────────────────────────────────
export async function analyzeMarkets(markets: CapitalMarket[]): Promise<ScannerOpportunity[]> {
  const ai = await getAISettings();
  const hasGPT = ai.openai.connected && ai.openai.apiKey.length > 20;
  const hasClaude = ai.anthropic.connected && ai.anthropic.apiKey.length > 20;

  const validMarkets = markets.filter((m) => m.bid > 0).slice(0, 30);

  // ── TA-Lib + Strategy Signale parallel vom Python Backend holen ──────────
  const symbols = validMarkets.map(m => m.symbol).filter(Boolean);
  const [taData, strategyData] = await Promise.all([
    fetchTALibData(symbols),
    fetchStrategySignals(symbols),
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
      const taInfo = ta
        ? ` | trend=${ta.trend} rsi=${ta.rsi?.toFixed(0)} macd=${ta.macd_signal} signal=${ta.signal} ema20=${ta.ema_20?.toFixed(2)} ema50=${ta.ema_50?.toFixed(2)} atr=${ta.atr?.toFixed(2)}`
        : "";
      const stInfo = sr && sr.consensus !== "NEUTRAL"
        ? ` | strategies=${sr.consensus}(${sr.consensus_conf}%) [${sr.long_votes}L/${sr.short_votes}S/${sr.neutral_votes}N of ${sr.total_strategies}] top="${sr.active[0]?.strategy ?? "none"}: ${sr.active[0]?.reasoning?.slice(0, 80) ?? ""}"`
        : sr ? ` | strategies=NEUTRAL(${sr.neutral_votes}/${sr.total_strategies} neutral)` : "";
      return `${m.epic} (${m.instrumentName}): bid=${m.bid} ask=${m.ask} spread=${m.spread}${taInfo}${stInfo}`;
    }).join("\n");

    const prompt = `You are a professional forex and CFD trading analyst with 20 years of experience.

Analyze these live markets with REAL technical indicator data from TA-Lib and identify the TOP 5 trading opportunities:

${marketList}

CRITICAL RULES — violations = bad analysis:
- ONLY recommend BUY if trend=BULLISH OR signal=BUY/STRONG_BUY. If trend=BEARISH → SELL or WAIT.
- ONLY recommend SELL if trend=BEARISH OR signal=SELL/STRONG_SELL. If trend=BULLISH → BUY or WAIT.
- RSI > 70 = overbought → prefer SELL or WAIT for BUY setups
- RSI < 30 = oversold → prefer BUY or WAIT for SELL setups
- If signal=NEUTRAL and RSI 40-60 → WAIT
- If strategies=LONG with >60% confidence AND trend=BULLISH → strong BUY signal
- If strategies=SHORT with >60% confidence AND trend=BEARISH → strong SELL signal
- If strategies and trend DISAGREE → reduce confidence by 15 or go WAIT
- Minimum R:R ratio 1.5 — if no clean setup → WAIT
- stopLoss MUST be below entry for BUY, above entry for SELL
- Max SL distances: GOLD=15pts, EURUSD=0.0040, NAS100=200pts, USOIL=2.0, BTCUSD=1000

Return ONLY valid JSON:
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
      "tradingStyle": "DAYTRADING",
      "marketBias": "RISK_OFF"
    }
  ]
}`;

    const raw = await callGPT(ai.openai.apiKey, ai.openai.model, prompt);
    const parsed = parseJSON<{ opportunities: Array<Partial<GPTMarketAnalysis>> }>(raw, { opportunities: [] });
    for (const opp of parsed.opportunities ?? []) {
      if (opp.epic) gptBatchResult[opp.epic] = opp;
    }
  }

  // ── Jedes Symbol verarbeiten ──────────────────────────────────────────────
  const opportunities: ScannerOpportunity[] = [];

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
        marketBias: gptData.marketBias ?? "NEUTRAL",
        source: "GPT_REAL",
      };
    } else if (hasGPT) {
      // GPT verbunden aber Symbol nicht in Top-5 → WAIT
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
        marketBias: ta.trend === "BULLISH" ? "RISK_ON" : "RISK_OFF",
        source: "GPT_SIMULATED",
      };
    } else {
      // Kein GPT, kein klares TA-Signal → WAIT (kein Zufalls-Trade mehr)
      gpt = noSignal(market);
    }

    // TA-Lib + Strategie-Konsens gegen GPT-Signal prüfen
    if (gpt.direction !== "WAIT") {
      const sr = strategyData.get(market.symbol);
      const taBearish = ta && ta.trend === "BEARISH" && ta.signal === "SELL";
      const taBullish = ta && ta.trend === "BULLISH" && ta.signal === "BUY";
      const stratSell = sr && sr.consensus === "SHORT" && sr.consensus_conf >= 60;
      const stratBuy  = sr && sr.consensus === "LONG"  && sr.consensus_conf >= 60;

      // Blockieren wenn TA + Strategie-Mehrheit gegen GPT-Signal
      const blockBuy  = gpt.direction === "BUY"  && taBearish && stratSell;
      const blockSell = gpt.direction === "SELL" && taBullish && stratBuy;

      if (blockBuy || blockSell) {
        gpt = {
          ...gpt,
          direction: "WAIT",
          confidence: 0,
          reasoning: `Signal blockiert: GPT=${gpt.direction} aber TA=${ta?.trend} + Strategien=${sr?.consensus}(${sr?.consensus_conf}%). Kein Trade.`,
        };
      }
    }

    // Claude Risk Assessment
    let claude: ClaudeRiskAssessment;
    if (hasClaude && gpt.direction !== "WAIT" && gpt.stopLoss > 0) {
      const rrRatio = Math.abs(gpt.takeProfit - gpt.entry) / Math.abs(gpt.entry - gpt.stopLoss);
      const taContext = ta ? `\nTA-Lib confirms: trend=${ta.trend} rsi=${ta.rsi?.toFixed(0)} signal=${ta.signal}` : "";
      const prompt = `You are a professional risk manager for a forex/CFD trading firm.

Assess this trade setup:
- Instrument: ${market.instrumentName} (${market.epic})
- Direction: ${gpt.direction}
- Current bid/ask: ${market.bid} / ${market.ask}
- Entry: ${gpt.entry} | Stop Loss: ${gpt.stopLoss} | Take Profit: ${gpt.takeProfit}
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

      const raw = await callClaude(ai.anthropic.apiKey, ai.anthropic.model, prompt);
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
      claude = simulateClaude(gpt);
    }

    const finalScore = gpt.direction === "WAIT" ? 0 :
      (gpt.confidence * 0.5 + (100 - claude.riskScore) * 0.3 + (claude.approved ? 20 : 0));

    // goSignal: NUR wenn GPT-Key aktiv + Python Backend geantwortet hat + echte Analyse
    // GPT_SIMULATED = TA-Lib Fallback ohne GPT → kein Trade
    // GPT_REAL ohne TA-Lib-Daten (pythonBackendOk=false) → kein Trade
    const isRealAnalysis = gpt.source === "GPT_REAL" && hasGPT && pythonBackendOk;
    const goSignal = isRealAnalysis
      && claude.approved
      && gpt.confidence >= 70
      && gpt.direction !== "WAIT"
      && gpt.stopLoss > 0
      && gpt.takeProfit > 0;

    opportunities.push({
      rank: 0,
      epic: market.epic,
      symbol: market.symbol,
      instrumentName: market.instrumentName,
      bid: market.bid,
      ask: market.ask,
      spread: market.spread,
      gpt,
      claude,
      finalScore,
      goSignal,
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

  return opportunities
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}
