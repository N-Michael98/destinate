/**
 * OrchestratorAgent — Chef der koordiniert alle anderen Agents
 *
 * Läuft jeden Zyklus (60s) und:
 * 1. Prüft Systembedingungen (Broker, Mode, Limits)
 * 2. Holt Marktdaten (Capital.com + Python Fallback)
 * 3. Delegiert an AnalysisAgent → ExecutionAgent
 * 4. Verwaltet Post-Trade Aktionen (Telegram, Python, Journal)
 * 5. Eigener Claude AI Manager: darf gesamten Zyklus pausieren wenn Lage unklar
 *
 * instrumentation.ts ruft nur noch runOrchestratorCycle() auf.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentBus } from "./agent-bus";
import { runAnalysisAgent } from "./analysis-agent";
import { runExecutionAgent } from "./execution-agent";
import { getDiagnosticsReport } from "./diagnostics-agent";
import type { CapitalMarket } from "../capital-com/capital-com-client";

const AGENT_ID = "OrchestratorAgent";

// ── Watchlist ─────────────────────────────────────────────────────────────────

const WATCHLIST = [
  "NAS100","SPX500","UK100","GER40","DJ30","JPN225",
  "XAUUSD","USOIL","UKOIL","XAGUSD","NATGAS",
  "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","EURGBP","GBPJPY","EURJPY",
  "BTCUSD","ETHUSD",
];

const INSTRUMENT_META: Record<string, { epic: string; name: string; type: string }> = {
  NAS100: { epic: "US100",       name: "Nasdaq 100",   type: "INDICES" },
  SPX500: { epic: "US500",       name: "S&P 500",      type: "INDICES" },
  UK100:  { epic: "UK100",       name: "FTSE 100",     type: "INDICES" },
  GER40:  { epic: "GERMANY40",   name: "DAX 40",       type: "INDICES" },
  DJ30:   { epic: "US30",        name: "Dow Jones",    type: "INDICES" },
  JPN225: { epic: "JAPAN225",    name: "Nikkei 225",   type: "INDICES" },
  XAUUSD: { epic: "GOLD",        name: "Gold",         type: "COMMODITIES" },
  USOIL:  { epic: "OIL_CRUDE",   name: "Crude Oil",    type: "COMMODITIES" },
  UKOIL:  { epic: "OIL_BRENT",   name: "Brent Oil",    type: "COMMODITIES" },
  XAGUSD: { epic: "SILVER",      name: "Silver",       type: "COMMODITIES" },
  NATGAS: { epic: "NATURAL_GAS", name: "Natural Gas",  type: "COMMODITIES" },
  EURUSD: { epic: "EURUSD",      name: "EUR/USD",      type: "CURRENCIES" },
  GBPUSD: { epic: "GBPUSD",      name: "GBP/USD",      type: "CURRENCIES" },
  USDJPY: { epic: "USDJPY",      name: "USD/JPY",      type: "CURRENCIES" },
  USDCHF: { epic: "USDCHF",      name: "USD/CHF",      type: "CURRENCIES" },
  AUDUSD: { epic: "AUDUSD",      name: "AUD/USD",      type: "CURRENCIES" },
  USDCAD: { epic: "USDCAD",      name: "USD/CAD",      type: "CURRENCIES" },
  EURGBP: { epic: "EURGBP",      name: "EUR/GBP",      type: "CURRENCIES" },
  GBPJPY: { epic: "GBPJPY",      name: "GBP/JPY",      type: "CURRENCIES" },
  EURJPY: { epic: "EURJPY",      name: "EUR/JPY",      type: "CURRENCIES" },
  BTCUSD: { epic: "BITCOIN",     name: "Bitcoin",      type: "CRYPTOCURRENCIES" },
  ETHUSD: { epic: "ETHEREUM",    name: "Ethereum",     type: "CRYPTOCURRENCIES" },
};

// ── AI Manager ────────────────────────────────────────────────────────────────

let aiClient: Anthropic | null = null;
function getAI(): Anthropic {
  if (!aiClient) aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return aiClient;
}

interface OrchestratorDecision {
  proceed: boolean;
  maxTradesThisCycle: number;
  reason: string;
  pauseMinutes?: number;
}

async function askAIManager(context: {
  openPositions: number;
  maxConcurrent: number;
  dailyCount: number;
  maxDaily: number;
  systemStatus: string;
  approvedSignals: number;
}): Promise<OrchestratorDecision> {
  try {
    const ai = getAI();
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `OrchestratorAgent Entscheidung:
Offene Positionen: ${context.openPositions}/${context.maxConcurrent}
Trades heute: ${context.dailyCount}/${context.maxDaily}
Systemstatus: ${context.systemStatus}
Genehmigte Signale: ${context.approvedSignals}

Darf dieser Zyklus Trades öffnen?
- CRITICAL System → NEIN
- Alle Limits erreicht → NEIN
- Sonst → JA, maximal 1 Trade pro Zyklus

Antworte NUR mit JSON:
{"proceed":true,"maxTradesThisCycle":1,"reason":"kurz"}`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (json) return JSON.parse(json) as OrchestratorDecision;
  } catch (err) {
    console.warn(`[orchestrator] AI Manager Fehler — Fallback proceed (${err})`);
  }
  return { proceed: true, maxTradesThisCycle: 1, reason: "fallback" };
}

// ── Marktdaten holen ──────────────────────────────────────────────────────────

async function fetchMarkets(
  apiKey: string, cst: string, secToken: string
): Promise<CapitalMarket[]> {
  const { capitalGetTopMarkets } = await import("../capital-com/capital-com-client");
  const capitalResult = await capitalGetTopMarkets(apiKey, cst, secToken);
  if (!capitalResult.ok) return [];

  const capitalMarkets = capitalResult.markets ?? [];
  const capitalSymbols = new Set(capitalMarkets.map((m: CapitalMarket) => m.symbol));
  const missingSymbols = WATCHLIST.filter(s => !capitalSymbols.has(s));

  let supplemented = [...capitalMarkets];

  if (missingSymbols.length > 0) {
    try {
      const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
      if (PYTHON_BASE) {
        const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: missingSymbols }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json() as { prices?: Array<{ symbol: string; price: number | null }> };
          for (const p of data.prices ?? []) {
            if (!p.price || p.price <= 0) continue;
            const meta = INSTRUMENT_META[p.symbol];
            if (!meta) continue;
            const spreadPct = meta.type === "CURRENCIES" ? 0.0002 : meta.type === "CRYPTOCURRENCIES" ? 0.001 : 0.0005;
            const half = p.price * spreadPct / 2;
            supplemented.push({
              epic: meta.epic,
              instrumentName: meta.name,
              instrumentType: meta.type,
              symbol: p.symbol,
              bid: Number((p.price - half).toFixed(5)),
              ask: Number((p.price + half).toFixed(5)),
              spread: Number((half * 2).toFixed(5)),
              updateTime: new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  console.log(`[orchestrator] Märkte: ${capitalMarkets.length} Capital + ${supplemented.length - capitalMarkets.length} Python = ${supplemented.length} total`);
  return supplemented;
}

// ── Post-Trade Aktionen ───────────────────────────────────────────────────────

async function postTradeActions(params: {
  candidate: { symbol: string; gpt: { direction: string; stopLoss: number; takeProfit: number; confidence: number; tradingStyle?: string }; bid?: number; claude: { maxRiskPercent: number } };
  execResult: Awaited<ReturnType<typeof runExecutionAgent>>;
  style: string;
  balance: number;
  riskPct: number;
  entryContext?: Record<string, unknown>;
}): Promise<void> {
  const { candidate, execResult, style, balance, riskPct, entryContext } = params;
  const result = execResult.capital;
  const icResult = execResult.icMarkets;

  // Telegram
  try {
    const { notifyTradeExecuted } = await import("../telegram-notifications/telegram-sender");
    const brokerLabel = icResult?.ok ? "Capital.com + IC Markets" : "Capital.com";
    await notifyTradeExecuted({
      symbol: candidate.symbol,
      direction: candidate.gpt.direction as "BUY" | "SELL",
      size: result?.size ?? 0,
      entry: result?.openLevel ?? 0,
      stopLoss: candidate.gpt.stopLoss ?? 0,
      takeProfit: candidate.gpt.takeProfit ?? 0,
      confidence: candidate.gpt.confidence,
      broker: brokerLabel,
      dealId: result?.dealId,
    });
  } catch { /* non-fatal */ }

  // Python lifecycle
  try {
    const { pyRegisterTrade, pyUpdateBalance } = await import("../python-backend/python-client");
    await pyUpdateBalance(balance);
    if (!result?.dealId) throw new Error("no dealId");
    await pyRegisterTrade({
      tradeId:      result.dealId,
      symbol:       candidate.symbol,
      direction:    candidate.gpt.direction as "BUY" | "SELL",
      entry:        result.openLevel ?? 0,
      stopLoss:     candidate.gpt.stopLoss ?? 0,
      takeProfit:   candidate.gpt.takeProfit ?? 0,
      size:         result.size ?? 0,
      confidence:   candidate.gpt.confidence,
      tradingStyle: style,
      broker:       "Capital.com",
      openedAt:     new Date().toISOString(),
    });
  } catch { /* non-fatal */ }

  // Journal
  try {
    const { saveCapitalTradeToJournal } = await import("../capital-com/capital-trade-tracker");
    await saveCapitalTradeToJournal({
      dealId:       result?.dealId ?? "unknown",
      symbol:       candidate.symbol,
      direction:    candidate.gpt.direction as "BUY" | "SELL",
      tradingStyle: style,
      strategy:     candidate.gpt.tradingStyle ?? style,
      entry:        result?.openLevel ?? 0,
      stopLoss:     candidate.gpt.stopLoss ?? 0,
      takeProfit:   candidate.gpt.takeProfit ?? 0,
      size:         result?.size ?? 0,
      accountBalance: balance,
      riskPercent:  riskPct,
      confidence:   candidate.gpt.confidence,
      entryContext,
    });
  } catch { /* non-fatal */ }
}

// ── Trading Session Check ─────────────────────────────────────────────────────
// London:   08:00–17:00 UTC  |  New York: 13:00–22:00 UTC
// Overlap:  13:00–17:00 UTC  (aktivste Zeit)
// Gesamt:   08:00–22:00 UTC, Montag–Freitag

function isWithinTradingSession(): boolean {
  const now = new Date();
  const dayUTC = now.getUTCDay(); // 0=So, 1=Mo, ..., 5=Fr, 6=Sa
  if (dayUTC === 0 || dayUTC === 6) return false; // Wochenende

  const hourUTC = now.getUTCHours();
  const minuteUTC = now.getUTCMinutes();
  const timeUTC = hourUTC * 60 + minuteUTC;

  const londonOpen  =  8 * 60; //  08:00 UTC
  const nyClose     = 22 * 60; //  22:00 UTC

  return timeUTC >= londonOpen && timeUTC < nyClose;
}

// ── Hauptzyklus ───────────────────────────────────────────────────────────────

export async function runOrchestratorCycle(): Promise<void> {
  console.log(`[orchestrator] Zyklus gestartet`);

  // ── 1. Broker + Mode prüfen ────────────────────────────────────────────────
  const { isCapitalConnected, getCapitalSession } = await import("../capital-com/capital-com-session");
  const { getSettings } = await import("../settings/settings-store");
  if (!isCapitalConnected()) {
    console.log("[orchestrator] Capital nicht verbunden — Zyklus übersprungen");
    return;
  }
  const settings = await getSettings();
  if (settings.botSettings.mode !== "AUTO") {
    console.log("[orchestrator] Modus nicht AUTO — Zyklus übersprungen");
    return;
  }

  // ── 1b. Trading Session prüfen (London 08:00 + New York bis 22:00 UTC) ────
  // Ausnahme: Offene Positionen werden auch ausserhalb der Session überwacht
  const { capitalGetPositions } = await import("../capital-com/capital-com-client");
  const session0 = getCapitalSession()!;
  const posCheck = await capitalGetPositions(session0.apiKey, session0.cst, session0.securityToken).catch(() => null);
  const hasOpenPositions = (posCheck?.positions?.length ?? 0) > 0;

  if (!isWithinTradingSession()) {
    if (hasOpenPositions) {
      console.log("[orchestrator] Ausserhalb Session — aber offene Positionen vorhanden, nur Monitoring (kein neuer Trade)");
      // Kein return — läuft weiter aber ExecutionAgent wird nicht aufgerufen (openCount >= maxConcurrent gesetzt)
    } else {
      console.log("[orchestrator] Ausserhalb Trading Session (Mo–Fr 08:00–22:00 UTC) — Zyklus übersprungen");
      return;
    }
  }

  const session = getCapitalSession()!;

  // ── 2. Limiten prüfen ─────────────────────────────────────────────────────
  const maxConcurrent = settings.botSettings.maxConcurrentPositions ?? 3;
  const maxTradesPerDay = settings.botSettings.maxTradesPerDay ?? 5;
  const tradeLimitEnabled = settings.botSettings.tradeLimitEnabled ?? true;
  const today = new Date().toISOString().slice(0, 10);

  const { cacheGet, cacheSet } = await import("../cache/redis-cache");
  const redisDailyKey = `daily_trades:${today}`;
  const redisDailyRaw = await cacheGet<{ count: number; byStyle: Record<string, number> }>(redisDailyKey);
  if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
    global.__daily_trades__ = { date: today, count: redisDailyRaw?.count ?? 0, byStyle: redisDailyRaw?.byStyle ?? {} };
  }
  const dailyCount = global.__daily_trades__.count;

  const posResult = posCheck; // bereits geholt im Session-Check oben
  const openCount = posResult?.positions?.length ?? 0;

  // Ausserhalb Session: keine neuen Trades
  const blockNewTrades = !isWithinTradingSession();

  if (blockNewTrades && openCount === 0) {
    console.log("[orchestrator] Ausserhalb Session, keine offenen Positionen — Zyklus übersprungen");
    return;
  }
  if (blockNewTrades && openCount > 0) {
    console.log(`[orchestrator] Ausserhalb Session — ${openCount} offene Positionen werden überwacht, kein neuer Trade`);
  }
  if (openCount >= maxConcurrent) {
    console.log(`[orchestrator] Max Positionen erreicht (${openCount}/${maxConcurrent}) — übersprungen`);
    return;
  }
  if (tradeLimitEnabled && dailyCount >= maxTradesPerDay) {
    console.log(`[orchestrator] Tageslimit erreicht (${dailyCount}/${maxTradesPerDay}) — übersprungen`);
    return;
  }

  // ── 3. Marktdaten holen ───────────────────────────────────────────────────
  const markets = await fetchMarkets(session.apiKey, session.cst, session.securityToken);
  if (!markets.length) {
    console.log("[orchestrator] Keine Marktdaten — übersprungen");
    return;
  }

  // ── 4. AnalysisAgent ──────────────────────────────────────────────────────
  const analysisResult = await runAnalysisAgent(markets);

  // Scanner-UI aktualisieren
  global.__last_scan_result__ = {
    opportunities: analysisResult.opportunities,
    updatedAt: new Date().toISOString(),
  };

  // ── 5. OrchestratorAgent AI-Entscheidung ──────────────────────────────────
  const diagnostics = getDiagnosticsReport();
  const aiDecision = await askAIManager({
    openPositions: openCount,
    maxConcurrent,
    dailyCount,
    maxDaily: maxTradesPerDay,
    systemStatus: diagnostics.systemStatus,
    approvedSignals: analysisResult.approved.length,
  });

  if (!aiDecision.proceed) {
    console.log(`[orchestrator] AI hat Zyklus pausiert: ${aiDecision.reason}`);
    agentBus.publish({
      type: "DIAGNOSTICS:ALERT",
      agentId: AGENT_ID,
      timestamp: new Date().toISOString(),
      payload: { action: "CYCLE_PAUSED", reason: aiDecision.reason },
    });
    return;
  }

  // ── 6. Kandidaten filtern (ausserhalb Session: kein neuer Trade) ─────────
  if (blockNewTrades) {
    console.log("[orchestrator] Ausserhalb Session — Analyse fertig, kein Trade-Execution");
    return;
  }

  const threshold = settings.botSettings.autoApproveThreshold ?? 71;
  const styleLimit = settings.botSettings.maxTradesPerDayByStyle ?? { DAYTRADING: 3, SCALPING: 5, SWING: 2 };

  const candidates = analysisResult.approved.filter(o => {
    if (o.gpt.confidence < threshold) return false;
    const s = (o.gpt.tradingStyle ?? "DAYTRADING").toUpperCase();
    if ((global.__daily_trades__?.byStyle[s] ?? 0) >= ((styleLimit as Record<string, number>)[s] ?? 999)) return false;
    return true;
  });

  if (!candidates.length) {
    console.log("[orchestrator] Keine Kandidaten nach Filter — Zyklus beendet");
    return;
  }

  // ── 6b. Analysis-Engine Insights (rein additiv — null = kein Einfluss) ────
  let analysisInsights: Awaited<ReturnType<typeof import("../analysis-engine/insights-reader").getAnalysisInsights>> = null;
  let getSymbolScore: typeof import("../analysis-engine/insights-reader").getSymbolScore | null = null;
  try {
    const mod = await import("../analysis-engine/insights-reader");
    analysisInsights = await mod.getAnalysisInsights();
    getSymbolScore = mod.getSymbolScore;
    const warnings = analysisInsights?.ai?.newsWarnings ?? [];
    for (const w of warnings.slice(0, 3)) {
      console.log(`[orchestrator] 📰 Analysis-Engine Warnung: ${w}`);
    }
  } catch { /* non-fatal — Trading läuft ohne Insights weiter */ }

  // ── 6c. Bestätigte Overrides (Stufe 1C — nur was Admin per /apply freigab) ─
  let appliedOverrides: Record<string, import("../analysis-engine/overrides-store").SymbolOverride> = {};
  try {
    const { getAppliedOverrides } = await import("../analysis-engine/overrides-store");
    appliedOverrides = await getAppliedOverrides();
    if (Object.keys(appliedOverrides).length > 0) {
      console.log(`[orchestrator] 🔧 Aktive Overrides: ${Object.keys(appliedOverrides).join(", ")}`);
    }
  } catch { /* non-fatal */ }

  // ── 7. Pro Kandidat: Filter → ExecutionAgent ──────────────────────────────
  const { runAllFilters, getVolatilityAdjustedRisk } = await import("../trading-filters/trade-filters");
  const currentBalance = session.balance > 0 ? session.balance : 10000;
  const maxDailyLossPct = settings.riskSettings?.maxDailyDrawdownPct ?? 3.0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openPositionsList = (posResult?.positions ?? []).map((p: any) => ({
    symbol: p.market?.symbol as string | undefined,
    epic: p.market?.epic as string | undefined,
    direction: p.position?.direction as string | undefined,
  }));

  let tradesThisCycle = 0;

  for (const candidate of candidates) {
    if (tradesThisCycle >= aiDecision.maxTradesThisCycle) break;

    let style = (candidate.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as "DAYTRADING" | "SCALPING" | "SWING";

    // Stufe 1C: Vom Admin bestätigter Override für dieses Symbol
    const override = appliedOverrides[candidate.symbol.toUpperCase()];
    if (override?.style) {
      style = override.style;
      console.log(`[orchestrator] 🔧 ${candidate.symbol}: Override aktiv — Style=${style}${override.slPct ? ` SL=${(override.slPct * 100).toFixed(1)}%` : ""}`);
    }

    // Analysis-Engine Score: nur EXTREM schlechte Märkte (<30) blocken.
    // Philosophie: schwache Märkte werden diagnostiziert, nicht gemieden.
    if (getSymbolScore) {
      const score = getSymbolScore(analysisInsights, candidate.symbol);
      if (score !== null && score < 30) {
        console.log(`[orchestrator] 🧠 ${candidate.symbol} übersprungen — Analysis-Engine Score ${score}/100 (Diagnose läuft nachts)`);
        continue;
      }
    }

    // Trading Filters
    const filterResult = await runAllFilters({
      symbol: candidate.symbol,
      direction: candidate.gpt.direction as "BUY" | "SELL",
      bid: candidate.bid ?? 0,
      spread: candidate.spread ?? 0,
      instrumentType: candidate.instrumentType ?? "CURRENCIES",
      currentBalance,
      openPositions: openPositionsList,
      maxDailyLossPct,
    });
    if (!filterResult.allowed) {
      console.log(`[orchestrator] 🚫 ${candidate.symbol} GEBLOCKT [${filterResult.blockedBy}]: ${filterResult.reason}`);
      continue;
    }

    // Volatility-adjusted Risk
    const atr = (candidate.taSignals as { atr?: number } | undefined)?.atr ?? 0;
    const baseRisk = Math.min(candidate.claude.maxRiskPercent, settings.riskSettings.maxRiskPerTradePct);
    const riskPct = getVolatilityAdjustedRisk(candidate.symbol, baseRisk, atr, candidate.bid ?? 0);

    // ExecutionAgent
    const isBuy = candidate.gpt.direction === "BUY";
    const entryPrice = isBuy ? (candidate.ask ?? candidate.bid ?? 0) : (candidate.bid ?? 0);

    // Override-SL/TP: prozentual vom aktuellen Preis (aus Backtest-Evidenz)
    let slPrice = candidate.gpt.stopLoss > 0 ? candidate.gpt.stopLoss : undefined;
    let tpPrice = candidate.gpt.takeProfit > 0 ? candidate.gpt.takeProfit : undefined;
    if (override && entryPrice > 0) {
      if (override.slPct && override.slPct > 0) {
        slPrice = isBuy ? entryPrice * (1 - override.slPct) : entryPrice * (1 + override.slPct);
      }
      if (override.tpPct && override.tpPct > 0) {
        tpPrice = isBuy ? entryPrice * (1 + override.tpPct) : entryPrice * (1 - override.tpPct);
      }
    }

    const execResult = await runExecutionAgent({
      symbol: candidate.symbol,
      direction: isBuy ? "BUY" : "SELL",
      riskPercent: riskPct,
      accountBalance: currentBalance,
      stopLossPrice: slPrice,
      takeProfitPrice: tpPrice,
      currentPrice: entryPrice,
      confidence: candidate.gpt.confidence,
      strategy: candidate.gpt.tradingStyle ?? style,
      tradingStyle: style,
      signalGeneratedAt: new Date().toISOString(),
    });

    if (execResult.ok) {
      tradesThisCycle++;
      global.__daily_trades__.count++;
      global.__daily_trades__.byStyle[style] = (global.__daily_trades__.byStyle[style] ?? 0) + 1;
      await cacheSet(redisDailyKey, { count: global.__daily_trades__.count, byStyle: global.__daily_trades__.byStyle }, 90000);

      const icLog = execResult.icMarkets?.ok ? `IC:✅${execResult.icMarkets.positionId}` : "IC:❌";
      console.log(`[orchestrator] ✅ Trade: ${candidate.symbol} ${candidate.gpt.direction} (${style}) Deal=${execResult.capital?.dealId} | ${icLog}`);

      // Stufe 2: Marktbedingungen beim Entry festhalten (für Analysis-Engine-Diagnosen)
      const now = new Date();
      const entryContext: Record<string, unknown> = {
        hourUTC: now.getUTCHours(),
        dayUTC: now.getUTCDay(),
        atr,
        spread: candidate.spread ?? 0,
        bid: candidate.bid ?? 0,
        ask: candidate.ask ?? 0,
        styleUsed: style,
        gptStyle: candidate.gpt.tradingStyle ?? null,
        riskPctUsed: riskPct,
        aiScore: getSymbolScore ? getSymbolScore(analysisInsights, candidate.symbol) : null,
        overrideActive: !!override,
        ...(override ? { overrideStrategy: override.strategy } : {}),
      };

      await postTradeActions({ candidate, execResult, style, balance: session.balance, riskPct, entryContext });
      break; // 1 Trade pro Zyklus
    } else {
      console.warn(`[orchestrator] ❌ ${candidate.symbol} fehlgeschlagen: ${execResult.aiReason}`);
    }
  }

  console.log(`[orchestrator] Zyklus beendet — ${tradesThisCycle} Trade(s) ausgeführt`);
}
