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
import { pythonBackendAuthHeader } from "@/lib/python-backend/auth-header";
import { runAnalysisAgent } from "./analysis-agent";
import { runExecutionAgent } from "./execution-agent";
import { getDiagnosticsReport } from "./diagnostics-agent";
import type { CapitalMarket } from "../capital-com/capital-com-client";
import { MIN_SIGNAL_CONFIDENCE } from "../broker-config";

const AGENT_ID = "OrchestratorAgent";

// ── Watchlist ─────────────────────────────────────────────────────────────────

// ERWEITERT 03.08. auf 30 (vorher 22) — bewusste Entscheidung des Nutzers.
// Hintergrund: die WATCHLIST diente hier nie als Filter, sondern nur dazu,
// fehlende Symbole nachzuholen. Analysiert und gehandelt wurde immer alles,
// was Capital.com lieferte. Solange die falschen Epics und das Ratenlimit nur
// rund 10 Märkte durchliessen, fiel das nicht auf; nach deren Behebung kamen
// plötzlich alle 30. Statt die Liste als Filter zu missbrauchen, deckt sie nun
// offen, was tatsächlich gehandelt wird — Deklaration und Wirklichkeit gleich.
const WATCHLIST = [
  "NAS100","SPX500","UK100","GER40","DJ30","JPN225",
  "XAUUSD","USOIL","UKOIL","XAGUSD","NATGAS",
  "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP","GBPJPY","EURJPY",
  "BTCUSD","ETHUSD","LTCUSD","XRPUSD","ADAUSD","SOLUSD","DOTUSD","LNKUSD","BNBUSD",
];

const INSTRUMENT_META: Record<string, { epic: string; name: string; type: string }> = {
  NAS100: { epic: "US100",       name: "Nasdaq 100",   type: "INDICES" },
  SPX500: { epic: "US500",       name: "S&P 500",      type: "INDICES" },
  UK100:  { epic: "UK100",       name: "FTSE 100",     type: "INDICES" },
  GER40:  { epic: "DE40",        name: "DAX 40",       type: "INDICES" },
  DJ30:   { epic: "US30",        name: "Dow Jones",    type: "INDICES" },
  JPN225: { epic: "J225",        name: "Nikkei 225",   type: "INDICES" },
  XAUUSD: { epic: "GOLD",        name: "Gold",         type: "COMMODITIES" },
  USOIL:  { epic: "OIL_CRUDE",   name: "Crude Oil",    type: "COMMODITIES" },
  UKOIL:  { epic: "OIL_BRENT",   name: "Brent Oil",    type: "COMMODITIES" },
  XAGUSD: { epic: "SILVER",      name: "Silver",       type: "COMMODITIES" },
  NATGAS: { epic: "NATURALGAS",  name: "Natural Gas",  type: "COMMODITIES" },
  EURUSD: { epic: "EURUSD",      name: "EUR/USD",      type: "CURRENCIES" },
  GBPUSD: { epic: "GBPUSD",      name: "GBP/USD",      type: "CURRENCIES" },
  USDJPY: { epic: "USDJPY",      name: "USD/JPY",      type: "CURRENCIES" },
  USDCHF: { epic: "USDCHF",      name: "USD/CHF",      type: "CURRENCIES" },
  AUDUSD: { epic: "AUDUSD",      name: "AUD/USD",      type: "CURRENCIES" },
  USDCAD: { epic: "USDCAD",      name: "USD/CAD",      type: "CURRENCIES" },
  EURGBP: { epic: "EURGBP",      name: "EUR/GBP",      type: "CURRENCIES" },
  GBPJPY: { epic: "GBPJPY",      name: "GBP/JPY",      type: "CURRENCIES" },
  EURJPY: { epic: "EURJPY",      name: "EUR/JPY",      type: "CURRENCIES" },
  NZDUSD: { epic: "NZDUSD",      name: "NZD/USD",      type: "CURRENCIES" },
  BTCUSD: { epic: "BTCUSD",      name: "Bitcoin",      type: "CRYPTOCURRENCIES" },
  ETHUSD: { epic: "ETHUSD",      name: "Ethereum",     type: "CRYPTOCURRENCIES" },
  LTCUSD: { epic: "LTCUSD",      name: "Litecoin",     type: "CRYPTOCURRENCIES" },
  XRPUSD: { epic: "XRPUSD",      name: "Ripple (XRP)", type: "CRYPTOCURRENCIES" },
  ADAUSD: { epic: "ADAUSD",      name: "Cardano",      type: "CRYPTOCURRENCIES" },
  SOLUSD: { epic: "SOLUSD",      name: "Solana",       type: "CRYPTOCURRENCIES" },
  DOTUSD: { epic: "DOTUSD",      name: "Polkadot",     type: "CRYPTOCURRENCIES" },
  LNKUSD: { epic: "LINKUSD",     name: "Chainlink",    type: "CRYPTOCURRENCIES" },
  BNBUSD: { epic: "BNBUSD",      name: "BNB",          type: "CRYPTOCURRENCIES" },
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

let lastOrchestratorGateAlertAt = 0;
async function alertAIGateFallback(gate: string, err: unknown): Promise<void> {
  const now = Date.now();
  if (now - lastOrchestratorGateAlertAt < 60 * 60 * 1000) return; // max 1x/Stunde
  lastOrchestratorGateAlertAt = now;
  try {
    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    await sendTelegram(
      `⚠️ AI-Sicherheitsgate "${gate}" nicht erreichbar — Fallback aktiv (Trades laufen ungeprüft weiter, andere Sicherheitsschichten bleiben aktiv). Fehler: ${err instanceof Error ? err.message : String(err)}`
    );
  } catch { /* non-fatal */ }
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
    await alertAIGateFallback("Orchestrator", err);
  }
  return { proceed: true, maxTradesThisCycle: 1, reason: "fallback" };
}

// ── Marktdaten holen ──────────────────────────────────────────────────────────

/** Alter eines ISO-Zeitstempels in Minuten. null wenn nicht auswertbar —
 *  der Aufrufer behandelt das als "unbekannt", NICHT als frisch (02.08.). */
function ageInMinutes(iso: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const age = (Date.now() - t) / 60000;
  return age >= 0 ? Number(age.toFixed(1)) : 0; // Zukunft (Zeitzonen-Drift) = frisch
}

async function fetchMarkets(
  apiKey: string, cst: string, secToken: string
): Promise<CapitalMarket[]> {
  const { capitalGetTopMarkets } = await import("../capital-com/capital-com-client");
  const capitalResult = await capitalGetTopMarkets(apiKey, cst, secToken);
  if (!capitalResult.ok) return [];

  const capitalMarkets = capitalResult.markets ?? [];
  const capitalSymbols = new Set(capitalMarkets.map((m: CapitalMarket) => m.symbol));
  let missingSymbols = WATCHLIST.filter(s => !capitalSymbols.has(s));

  // KORREKTUR 02.08.: Die Hauptliste von Capital.com wurde vorher unverändert
  // übernommen — OHNE Altersangabe. Damit galten ausgerechnet die meisten
  // Märkte (laut Logs 14 von 22) für die Aktualitätsprüfung als "Alter
  // unbekannt" und wurden nie geprüft. Jetzt wird das Alter aus dem echten
  // Broker-Zeitstempel berechnet; fehlt dieser, bleibt es null (= unbekannt,
  // wird gewarnt statt blockiert).
  let supplemented: CapitalMarket[] = capitalMarkets.map((m: CapitalMarket) => ({
    ...m,
    ageMinutes: m.updateTime ? ageInMinutes(m.updateTime) : null,
    priceSource: "CAPITAL" as const,
  }));

  // ── Stufe 1: ECHTE Capital.com-Preise für fehlende Symbole ────────────────
  // In 5er-Gruppen mit Pause: Capital-Rate-Limit (~10 req/s) verwarf bei
  // 16 parallelen Anfragen einen Teil (Beleg 08.07.: nur 7/16 geliefert).
  let realPriceAdded = 0;
  if (missingSymbols.length > 0) {
    try {
      const { capitalGetPrices } = await import("../capital-com/capital-com-client");
      const CHUNK = 5;
      for (let i = 0; i < missingSymbols.length; i += CHUNK) {
        if (i > 0) await new Promise(r => setTimeout(r, 400)); // Rate-Limit-Pause
        const chunk = missingSymbols.slice(i, i + CHUNK);
        const pr = await capitalGetPrices(apiKey, cst, secToken, chunk).catch(() => null);
        for (const p of pr?.prices ?? []) {
          const meta = INSTRUMENT_META[p.symbol];
          if (!meta || !(p.bid > 0 && p.ask > 0)) continue;
          // Broker-Kurse sind live — trotzdem das Alter aus dem ECHTEN
          // Capital-Zeitstempel berechnen (02.08.), damit die Aktualitäts-
          // prüfung auch diesen Pfad abdeckt und nicht nur den yfinance-
          // Rückfall. Fehlt der Zeitstempel, bleibt das Alter unbekannt
          // (wird gewarnt, nicht blockiert) statt Frische vorzutäuschen.
          const capAge = p.updateTime ? ageInMinutes(p.updateTime) : null;
          supplemented.push({
            epic: meta.epic,
            instrumentName: meta.name,
            instrumentType: meta.type,
            symbol: p.symbol,
            bid: p.bid,
            ask: p.ask,
            spread: p.spread,
            updateTime: p.updateTime ?? "",
            ageMinutes: capAge,
            priceSource: "CAPITAL",
          });
          realPriceAdded++;
        }
      }
      if (realPriceAdded > 0) {
        const nowCovered = new Set(supplemented.map(m => m.symbol));
        missingSymbols = missingSymbols.filter(s => !nowCovered.has(s));
      }
      // Fern-Diagnose: WELCHE Symbole liefert Capital nicht (und landen im Fallback)?
      if (missingSymbols.length > 0) {
        console.log(`[orchestrator] Capital-Preise fehlen für: ${missingSymbols.join(", ")} — Python-Fallback greift`);
      }
    } catch { /* non-fatal — Python-Fallback unten greift */ }
  }

  // ── Stufe 2: Python/yfinance-Fallback nur noch für den Rest ───────────────
  if (missingSymbols.length > 0) {
    try {
      const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
      if (PYTHON_BASE) {
        const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...pythonBackendAuthHeader() },
          body: JSON.stringify({ symbols: missingSymbols }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json() as {
            prices?: Array<{
              symbol: string; price: number | null;
              asOf?: string | null; ageMinutes?: number | null; asOfPrecision?: string | null;
            }>
          };
          for (const p of data.prices ?? []) {
            if (!p.price || p.price <= 0) continue;
            const meta = INSTRUMENT_META[p.symbol];
            if (!meta) continue;
            const spreadPct = meta.type === "CURRENCIES" ? 0.0002 : meta.type === "CRYPTOCURRENCIES" ? 0.001 : 0.0005;
            const half = p.price * spreadPct / 2;
            // KORREKTUR 02.08.: hier stand `updateTime: new Date()` — JEDER
            // Fallback-Preis wurde also mit der aktuellen Uhrzeit gestempelt,
            // egal wie alt er wirklich war (ein 57 Stunden alter Nikkei-Kurs
            // sah taufrisch aus). Jetzt kommt der ECHTE Zeitstempel aus dem
            // Backend; nur wenn dieser fehlt, bleibt updateTime leer statt
            // eine Aktualität vorzutäuschen.
            supplemented.push({
              epic: meta.epic,
              instrumentName: meta.name,
              instrumentType: meta.type,
              symbol: p.symbol,
              bid: Number((p.price - half).toFixed(5)),
              ask: Number((p.price + half).toFixed(5)),
              spread: Number((half * 2).toFixed(5)),
              updateTime: p.asOf ?? "",
              ageMinutes: p.ageMinutes ?? null,
              priceSource: "YFINANCE_FALLBACK",
            });
            if (p.ageMinutes != null && p.ageMinutes > 15) {
              console.warn(`[orchestrator] ⏳ ${p.symbol}: Kurs ist ${Math.round(p.ageMinutes)} Min alt (${p.asOfPrecision ?? "?"}) — Markt vermutlich geschlossen`);
            }
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  const capitalTotal = capitalMarkets.length + realPriceAdded;
  console.log(`[orchestrator] Märkte: ${capitalTotal} Capital(echt) + ${supplemented.length - capitalTotal} Python(yfinance) = ${supplemented.length} total`);

  // Kurs-Aktualität sichtbar machen (02.08.) — beantwortet bei JEDEM Zyklus
  // die Frage "sind die Kurse wirklich live?" mit echten Zahlen statt
  // Vermutung. Unbekanntes Alter wird bewusst getrennt ausgewiesen: das
  // bedeutet, dass die Quelle keinen Zeitstempel geliefert hat.
  {
    const withAge = supplemented.filter(m => m.ageMinutes != null);
    const unknown = supplemented.length - withAge.length;
    if (withAge.length > 0) {
      const ages = withAge.map(m => m.ageMinutes as number);
      const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
      const oldest = withAge.reduce((a, b) => ((a.ageMinutes as number) > (b.ageMinutes as number) ? a : b));
      console.log(
        `[orchestrator] 🕐 Kurs-Alter: Ø ${avg.toFixed(1)} Min | ältester ${oldest.symbol} ${Math.round(oldest.ageMinutes as number)} Min | ohne Zeitstempel: ${unknown}`
      );
    } else {
      console.warn(`[orchestrator] 🕐 Kurs-Alter: KEIN einziger Kurs hat einen Zeitstempel (${supplemented.length} Märkte) — Aktualität nicht prüfbar`);
    }
  }
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
  actualSL?: number;  // tatsächlich gesetzter SL (Override oder GPT)
  actualTP?: number;
}): Promise<void> {
  const { candidate, execResult, style, balance, riskPct, entryContext } = params;
  const actualSL = params.actualSL ?? candidate.gpt.stopLoss ?? 0;
  const actualTP = params.actualTP ?? candidate.gpt.takeProfit ?? 0;
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
      stopLoss: actualSL,
      takeProfit: actualTP,
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
      stopLoss:     actualSL,
      takeProfit:   actualTP,
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
      // Unbestaetigte Order mitschreiben (10.08.) — sonst ist ein
      // Phantom-Trade spaeter nicht von einem echten Nulltrade zu trennen.
      unbestaetigt: result?.unbestaetigt,
      dealId:       result?.dealId ?? "unknown",
      symbol:       candidate.symbol,
      direction:    candidate.gpt.direction as "BUY" | "SELL",
      tradingStyle: style,
      strategy:     candidate.gpt.tradingStyle ?? style,
      entry:        result?.openLevel ?? 0,
      stopLoss:     actualSL,
      takeProfit:   actualTP,
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

/**
 * Die Auto-Approve-Schwelle, die WIRKLICH gilt (10.08.).
 *
 * Ein gespeicherter Wert unter MIN_SIGNAL_CONFIDENCE hat keine Wirkung: die
 * Signalkette verwirft solche Signale schon vorher an drei Stellen. Der Regler
 * beginnt seit heute bei 70, aber ein aelterer gespeicherter Wert (oder ein
 * direkter API-Aufruf) kann darunter liegen. Dann wird das GEMELDET statt
 * stillschweigend hingenommen — ein Wert, der nicht wirkt und niemandem
 * auffaellt, ist genau die Klasse Fehler, die hier behoben wird.
 */
function wirksameApproveSchwelle(gespeichert: number | undefined): number {
  const wert = gespeichert ?? 71;
  if (wert < MIN_SIGNAL_CONFIDENCE) {
    console.warn(
      `[orchestrator] Auto-Approve-Schwelle ${wert} liegt unter der Untergrenze `
      + `${MIN_SIGNAL_CONFIDENCE} der Signalkette — sie wirkt nicht. `
      + `Es gilt weiterhin ${MIN_SIGNAL_CONFIDENCE}.`);
    return MIN_SIGNAL_CONFIDENCE;
  }
  return wert;
}

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

  // Fail-closed (30.07.): Ohne verlässliche Positionsliste darf KEIN neuer Trade
  // eröffnet werden. Vorher fiel openCount bei einem fehlgeschlagenen Abruf
  // stillschweigend auf 0 und openPositionsList auf [] — damit griffen weder
  // das Positions-Limit noch der Duplikat-/Pyramiding-Schutz, und es konnten
  // unkontrolliert gestapelte Positionen entstehen.
  // capitalGetPositions() wirft bei HTTP-Fehlern nicht, sondern liefert
  // {ok:false} OHNE positions — beide Fälle werden hier abgefangen.
  // Die Überwachung offener Positionen läuft davon unberührt weiter (eigener
  // 2-Minuten-Loop in instrumentation.ts).
  if (!posResult?.ok || !Array.isArray(posResult.positions)) {
    console.warn(`[orchestrator] ⛔ Offene Positionen nicht abrufbar (${posResult?.error ?? "Netzwerkfehler"}) — kein neuer Trade in diesem Zyklus`);
    return;
  }

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
  // Tageslimit — mit Bypass für sehr starke Signale.
  // Generalkontroll-Fund 30.07.: tradeLimitBypassScore stand in der Oberfläche
  // ("Limit erreicht → trotzdem Trade wenn Score ≥ Bypass-Wert"), wurde aber nur
  // in einer vom Live-Loop NIE aufgerufenen API-Route gelesen — der Regler hatte
  // also keinerlei Wirkung. Jetzt hier verdrahtet: bei erreichtem Limit wird der
  // Zyklus nicht mehr sofort abgebrochen, sondern die Freigabe-Schwelle auf den
  // Bypass-Wert angehoben. Nur Signale ab diesem Score kommen dann noch durch.
  const bypassScore = settings.botSettings.tradeLimitBypassScore ?? 0;
  const dailyLimitReached = tradeLimitEnabled && dailyCount >= maxTradesPerDay;
  if (dailyLimitReached && bypassScore <= 0) {
    console.log(`[orchestrator] Tageslimit erreicht (${dailyCount}/${maxTradesPerDay}) — übersprungen`);
    return;
  }
  if (dailyLimitReached) {
    console.log(`[orchestrator] Tageslimit erreicht (${dailyCount}/${maxTradesPerDay}) — nur noch Signale ab Score ${bypassScore}`);
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

  // ── 4b. Kosten-Guards: AI-Entscheidung nur wenn sie etwas bewirken kann ───
  if (blockNewTrades) {
    console.log("[orchestrator] Ausserhalb Session — Analyse fertig, kein Trade-Execution (kein AI-Call)");
    return;
  }
  if (analysisResult.approved.length === 0) {
    console.log("[orchestrator] Keine approved Signale — Zyklus beendet (kein AI-Call)");
    return;
  }

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

  // ── 6. Kandidaten filtern ──────────────────────────────────────────────────
  // Freigabe-Schwelle. "Min Signal Confidence" (riskSettings.minConfidenceScore)
  // war ebenfalls ein Regler ohne Wirkung (Generalkontroll-Fund 30.07., im UI
  // sichtbar, aber nur in einer ungenutzten API-Route gelesen). Jetzt aktiv,
  // bewusst nur VERSCHÄRFEND: es gilt immer der strengere der beiden Werte,
  // damit die Einstellung die bestehende Freigabe-Schwelle nie aufweichen kann.
  const baseThreshold = Math.max(
    wirksameApproveSchwelle(settings.botSettings.autoApproveThreshold),
    settings.riskSettings?.minConfidenceScore ?? 0,
  );
  // Bei erreichtem Tageslimit gilt zusätzlich die (höhere) Bypass-Schwelle —
  // siehe Kommentar beim Tageslimit oben.
  const threshold = dailyLimitReached ? Math.max(baseThreshold, bypassScore) : baseThreshold;
  const styleLimit = settings.botSettings.maxTradesPerDayByStyle ?? { DAYTRADING: 3, SCALPING: 5, SWING: 2 };

  // Walk-Forward-Robustheit (04.08.). Bis heute landeten diese Ergebnisse NUR
  // im Telegram-Bericht (periodic_report.py) — kein Handelspfad hat sie je
  // gelesen. Jetzt sind sie hier sichtbar; gesperrt wird aber nur, wenn die
  // Einstellung blockOverfitMarkets ausdrücklich eingeschaltet ist
  // (Standard: aus). Ist der Lauf zu alt, fehlgeschlagen oder Redis nicht
  // erreichbar, kommt null zurück und es ändert sich nichts.
  let ueberangepasst: string[] = [];
  try {
    const { getWalkforwardRobustheit } = await import("../analysis-engine/insights-reader");
    const wf = await getWalkforwardRobustheit();
    if (wf) {
      const sperren = settings.botSettings.blockOverfitMarkets === true;
      console.log(
        `[orchestrator] 🔬 Walk-Forward (${wf.alterTage} Tage alt): robust ${wf.robust.length} [${wf.robust.join(", ") || "-"}] | ` +
        `Überanpassungsverdacht ${wf.ueberangepasst.length} [${wf.ueberangepasst.join(", ") || "-"}] — ` +
        `${sperren ? "werden GESPERRT" : "nur Hinweis, nicht gesperrt"}`
      );
      if (sperren) ueberangepasst = wf.ueberangepasst;
    }
  } catch { /* non-fatal — ohne Robustheitsdaten läuft alles wie bisher */ }

  // JEDER Ausschluss wird benannt (06.08.).
  //
  // Vorher meldeten zwei der drei Bedingungen GAR NICHTS und am Ende stand nur
  // "Keine Kandidaten nach Filter". Belegt im Betriebslog 06.08. 22:21: die
  // Analyse gab NAS100 und GBPUSD mit conf=70 frei, der Zyklus endete direkt
  // danach ohne einen einzigen Hinweis, welche Bedingung gegriffen hat und mit
  // welchem Wert. Von aussen war das nicht von einem Fehler zu unterscheiden.
  //
  // Reine Ausgabe — an den Bedingungen selbst ist NICHTS geaendert.
  const verworfen: string[] = [];
  const candidates = analysisResult.approved.filter(o => {
    if (ueberangepasst.includes(o.symbol)) {
      console.log(`[orchestrator] 🔬 ${o.symbol} übersprungen — Walk-Forward meldet Überanpassung`);
      verworfen.push(`${o.symbol}: Walk-Forward-Überanpassung`);
      return false;
    }
    if (o.gpt.confidence < threshold) {
      verworfen.push(
        `${o.symbol}: Confidence ${o.gpt.confidence} < Schwelle ${threshold}` +
        ` (autoApprove ${wirksameApproveSchwelle(settings.botSettings.autoApproveThreshold)},` +
        ` minConfidence ${settings.riskSettings?.minConfidenceScore ?? 0}` +
        `${dailyLimitReached ? `, Tageslimit erreicht → Bypass ${bypassScore}` : ""})`
      );
      return false;
    }
    const s = (o.gpt.tradingStyle ?? "DAYTRADING").toUpperCase();
    const heute = global.__daily_trades__?.byStyle[s] ?? 0;
    const grenze = (styleLimit as Record<string, number>)[s] ?? 999;
    if (heute >= grenze) {
      verworfen.push(`${o.symbol}: Tageslimit ${s} erreicht (${heute}/${grenze})`);
      return false;
    }
    return true;
  });

  if (verworfen.length > 0) {
    console.log(`[orchestrator] 🚫 ${verworfen.length} von ${analysisResult.approved.length} freigegebenen Signalen verworfen: ${verworfen.join(" | ")}`);
  }

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
  // "Pause on Loss" war ein Regler ohne Wirkung (Generalkontroll-Fund 30.07.).
  // Jetzt aktiv, aber bewusst nur VERSCHÄRFEND: ist er eingeschaltet, gilt der
  // strengere der beiden Werte. Damit kann die Einstellung den bestehenden,
  // funktionierenden Tagesverlust-Schutz niemals aufweichen.
  const baseDailyLossPct = settings.riskSettings?.maxDailyDrawdownPct ?? 3.0;
  const maxDailyLossPct = (settings.botSettings.pauseOnLoss && (settings.botSettings.pauseOnLossPercent ?? 0) > 0)
    ? Math.min(baseDailyLossPct, settings.botSettings.pauseOnLossPercent)
    : baseDailyLossPct;
  // Symbole normalisieren ("GBP/JPY" → "GBPJPY") — sonst greifen
  // Korrelations- und Duplikat-Checks nicht (Capital liefert teils mit Slash)
  // KORREKTUR 30.07.: capitalGetPositions() liefert bereits FLACHE Objekte
  // (OpenPosition — symbol/epic/direction/openLevel/stopLevel auf oberster
  // Ebene). Vorher wurde hier p.market?.symbol bzw. p.position?.direction
  // gelesen — diese verschachtelte Capital.com-Rohform existiert nach der
  // Umwandlung im Client gar nicht mehr. Dadurch waren ALLE Felder undefined
  // und der Duplikat-Schutz hat NIE ausgelöst (Ursache der 3x USDCAD).
  // Der any-Cast hatte den Compiler daran gehindert das zu melden — deshalb
  // hier bewusst entfernt, damit so ein Fehler künftig auffliegt.
  const openPositionsList = (posResult?.positions ?? []).map((p) => ({
    dealId:     p.dealId,
    symbol:     p.symbol?.replace("/", "").toUpperCase(),
    epic:       p.epic?.toUpperCase(),
    direction:  p.direction as string | undefined,
    openLevel:  p.openLevel,
    stopLevel:  p.stopLevel,
  }));

  // Breakeven-Status der offenen Positionen — Quelle ist der beSet-Merker den
  // der RiskAgent über persistMeta schreibt (seit 29.07. neustart-fest).
  // Nur nötig wenn Pyramiding aktiv ist, sonst gar keine DB-Abfrage.
  const beByDealId = new Map<string, boolean>();
  if (settings.botSettings.pyramidingEnabled) {
    try {
      const { getPrisma } = await import("../../app/lib/prisma");
      const rows = await (getPrisma().$queryRawUnsafe as (q: string) => Promise<Array<{ notes: string }>>)(
        `SELECT notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%dealId%'`
      );
      for (const r of rows ?? []) {
        try {
          const m = JSON.parse(r.notes) as Record<string, unknown>;
          if (m.dealId) beByDealId.set(String(m.dealId), m.beSet === true);
        } catch { /* einzelne kaputte notes überspringen */ }
      }
    } catch (e) {
      console.warn("[orchestrator] BE-Status nicht ladbar — Pyramiding bleibt gesperrt:", e instanceof Error ? e.message : String(e));
    }
  }

  /** Position gilt als abgesichert, wenn der RiskAgent Breakeven gesetzt hat
   *  ODER der Stop live bereits am Einstieg oder darüber/darunter steht.
   *  Unbekannt = NICHT abgesichert (fail-safe: dann kein Nachkauf). */
  const isProtected = (p: { dealId?: string; direction?: string; openLevel?: number; stopLevel?: number | null }): boolean => {
    if (p.dealId && beByDealId.get(p.dealId) === true) return true;
    if (p.stopLevel == null || !p.openLevel) return false;
    return p.direction === "BUY" ? p.stopLevel >= p.openLevel : p.stopLevel <= p.openLevel;
  };

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

    // ── Duplikat-Schutz / Pyramiding ──────────────────────────────────────
    // Standard: max. 1 offene Position pro Symbol (3× GBPJPY gestapelt am
    // 06.07. = konzentriertes Risiko — nie wieder).
    // Mit aktiviertem Pyramiding sind mehrere erlaubt, aber NUR wenn jede
    // bestehende Position bereits auf Breakeven+ abgesichert ist und die neue
    // Analyse die konfigurierte Schwelle erreicht. Alle Werte kommen aus den
    // Einstellungen — nichts ist im Code fest verdrahtet.
    const candSym = candidate.symbol.toUpperCase().replace("/", "");
    const candEpic = INSTRUMENT_META[candidate.symbol]?.epic?.toUpperCase();
    const samePositions = openPositionsList.filter(p =>
      p.symbol === candSym || (candEpic && p.epic === candEpic)
    );

    if (samePositions.length > 0) {
      const pyrOn      = settings.botSettings.pyramidingEnabled ?? false;
      const maxPerSym  = settings.botSettings.maxPositionsPerSymbol ?? 1;
      // 0 = keine eigene Schwelle konfiguriert -> allgemeine Freigabe-Schwelle
      const pyrMinConf = settings.botSettings.pyramidingMinConfidence || threshold;

      if (!pyrOn || maxPerSym <= 1) {
        console.log(`[orchestrator] ⏭ ${candidate.symbol} übersprungen — Position bereits offen (Pyramiding aus)`);
        continue;
      }
      if (samePositions.length >= maxPerSym) {
        console.log(`[orchestrator] ⏭ ${candidate.symbol} übersprungen — Limit ${samePositions.length}/${maxPerSym} Positionen pro Symbol erreicht`);
        continue;
      }
      if (samePositions.some(p => p.direction !== candidate.gpt.direction)) {
        console.log(`[orchestrator] ⏭ ${candidate.symbol} übersprungen — bestehende Position in Gegenrichtung (kein Hedging)`);
        continue;
      }
      if (candidate.gpt.confidence < pyrMinConf) {
        console.log(`[orchestrator] ⏭ ${candidate.symbol} übersprungen — Confidence ${candidate.gpt.confidence} unter Pyramiding-Schwelle ${pyrMinConf}`);
        continue;
      }
      const ungesichert = samePositions.filter(p => !isProtected(p));
      if (ungesichert.length > 0) {
        console.log(`[orchestrator] ⏭ ${candidate.symbol} übersprungen — ${ungesichert.length} bestehende Position(en) noch nicht auf Breakeven`);
        continue;
      }
      console.log(`[orchestrator] 🔼 ${candidate.symbol}: Pyramiding erlaubt — ${samePositions.length}/${maxPerSym} offen, alle auf BE+, Confidence ${candidate.gpt.confidence} >= ${pyrMinConf}`);
    }

    // Analysis-Engine Score — TESTPHASE (User-Entscheid 15.07.): NUR LOGGEN,
    // nicht mehr blocken. Grund: Die Scores basieren noch auf den vergifteten
    // 0.0-P&L-Altdaten (Bug bis 13.07. behoben) — Blocken würde Märkte wegen
    // eines Datenfehlers benachteiligen. Alle 22 Märkte testen gleichberechtigt;
    // die 7 anderen Schutzstufen (Confidence, Meta-AI, Threshold, Duplikat,
    // Korrelation, Kalender, Tages-/Wochen-Limits) bleiben voll aktiv.
    // Reaktivierung des Blocks nach der Testphase: diesen Commit reverten.
    if (getSymbolScore) {
      const score = getSymbolScore(analysisInsights, candidate.symbol);
      if (score !== null && score < 30) {
        console.log(`[orchestrator] 🧠 ${candidate.symbol}: Score ${score}/100${override ? " (Override aktiv)" : ""} — Testphase: nur Hinweis, kein Block`);
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
      // Generalkontroll-Funde 30.07.: beide Einstellungen existierten, waren
      // aber nirgends implementiert — jetzt verdrahtet.
      maxTotalDrawdownPct: settings.riskSettings?.maxTotalDrawdownPct,
      maxExposurePct: settings.riskSettings?.maxExposurePct,
      availableMargin: session.accounts?.[0]?.available,
      // Kurs-Aktualität (02.08.) — verhindert Einstiege auf veralteten Kursen
      priceAgeMinutes: candidate.ageMinutes,
      maxPriceAgeMinutes: settings.botSettings.maxPriceAgeMinutes,
      // Wochenverlust-Grenze (10.08.): stand bis heute als Standardwert in der
      // Signatur des Filters und wurde nie uebergeben — als einziges der drei
      // Verlust-Limits war sie nicht einstellbar.
      maxWeeklyLossPct: settings.riskSettings?.maxWeeklyLossPct,
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
      // Slippage-Tracking (Woche 2, 26.07.): erwarteter Kurs beim Scan-Entscheid
      // (entryPrice = bid/ask vom Zyklusstart) vs. echter Fill von Capital.com
      // (execResult.capital.openLevel). Reine Messung — beeinflusst nichts,
      // liefert nur Daten für die spätere Auswertung (Wochen-Report).
      const actualFill = execResult.capital?.openLevel;
      // Vorzeichen: negativ = Slippage GEGEN uns (teurer bezahlt/billiger verkauft
      // als erwartet), positiv = zu unseren Gunsten. BUY: hoeherer Fill ist
      // schlechter -> entryPrice - actualFill. SELL: niedrigerer Fill ist
      // schlechter -> actualFill - entryPrice.
      const slippagePoints = (actualFill != null && entryPrice > 0)
        ? Number((isBuy ? entryPrice - actualFill : actualFill - entryPrice).toFixed(6))
        : null;
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
        // Entry-Engine Phase D: Qualitäts-Tier für spätere Auswertung
        entryQualityTier: (candidate as { entryQualityTier?: string }).entryQualityTier ?? null,
        entryQualityScore: (candidate as { entryQualityScore?: number }).entryQualityScore ?? null,
        aiScore: getSymbolScore ? getSymbolScore(analysisInsights, candidate.symbol) : null,
        overrideActive: !!override,
        ...(override ? { overrideStrategy: override.strategy } : {}),
        // Slippage-Tracking
        expectedEntryPrice: entryPrice,
        actualFillPrice: actualFill ?? null,
        slippagePoints,
      };

      await postTradeActions({
        candidate, execResult, style, balance: session.balance, riskPct, entryContext,
        actualSL: slPrice, actualTP: tpPrice,
      });
      break; // 1 Trade pro Zyklus
    } else {
      console.warn(`[orchestrator] ❌ ${candidate.symbol} fehlgeschlagen: ${execResult.aiReason}`);
    }
  }

  console.log(`[orchestrator] Zyklus beendet — ${tradesThisCycle} Trade(s) ausgeführt`);
}
