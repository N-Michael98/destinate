/**
 * Active Trade Manager — Capital.com
 * Orchestriert den RiskAgent: holt Positionen + Preise und übergibt sie.
 *
 * Läuft alle 2min. Die eigentliche Logik (BE, Trail, Partial TP)
 * liegt im RiskAgent (frontend/lib/agents/risk-agent.ts).
 */

import { getPrisma } from "../../app/lib/prisma";
import {
  capitalGetPrices, capitalGetPositions, EPIC_MAP,
} from "./capital-com-client";
import { fetchPrices as pyFetchPrices } from "../python-bridge/python-data";
import { getCapitalSession, isCapitalConnected } from "./capital-com-session";
import { runRiskAgent, type PosMeta } from "../agents/risk-agent";

export async function runActiveTradeManager(): Promise<void> {
  console.log("[trade-mgr] gestartet");

  // Heartbeat für den DiagnosticsAgent: beweist dass der 2-Min-Loop lebt —
  // auch wenn es nichts zu tun gibt (keine Positionen / keine Schwellen).
  // Vorher: RiskAgent meldete nur AKTIONEN → in ruhigen Phasen Fehlalarm
  // "Agent nicht mehr aktiv" nach 10 Min.
  try {
    const { agentBus } = await import("../agents/agent-bus");
    agentBus.publish({
      type: "RISK:HEARTBEAT",
      agentId: "RiskAgent",
      timestamp: new Date().toISOString(),
      payload: { source: "active-trade-manager" },
    });
  } catch { /* non-fatal */ }

  if (!isCapitalConnected()) {
    console.log("[trade-mgr] Capital nicht verbunden — abgebrochen");
    return;
  }
  const session = getCapitalSession()!;
  const db = getPrisma();

  // ── 1. Live-Positionen holen ──────────────────────────────────────────────
  const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
  console.log(`[trade-mgr] positions: ok=${posResult.ok} count=${posResult.positions?.length ?? 0}`);
  if (!posResult.ok || !posResult.positions?.length) return;

  // ── 2. DB-Metadaten laden ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbTrades = await (db.$queryRawUnsafe as any)(
    `SELECT notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%dealId%'`
  ) as Array<{ notes: string }>;

  const dbMeta = new Map<string, PosMeta>();
  for (const t of dbTrades) {
    try {
      const m = JSON.parse(t.notes);
      if (m.dealId) {
        dbMeta.set(m.dealId, {
          beSet:        m.beSet ?? false,
          partialDone:  m.partialDone ?? false,
          trailSL:      m.trailSL ?? null,
          peakPrice:    m.peakPrice ?? null,
          confidence:   m.confidence ?? 72,
          tradingStyle: m.tradingStyle ?? m.strategy ?? "DAYTRADING",
        });
      }
    } catch { /* skip */ }
  }

  // ── 3. Preise holen ───────────────────────────────────────────────────────
  const symbolsNeeded: string[] = [...new Set(
    posResult.positions.map((p: { symbol?: string }) => p.symbol).filter((s): s is string => !!s)
  )];
  console.log(`[trade-mgr] price fetch: ${symbolsNeeded.join(", ")}`);

  const priceResult = await capitalGetPrices(
    session.apiKey, session.cst, session.securityToken, symbolsNeeded
  ).catch(() => null);

  const priceMap = new Map<string, { bid: number; ask: number }>();
  for (const p of priceResult?.prices ?? []) {
    if (p.symbol && (p.bid > 0 || p.ask > 0)) {
      priceMap.set(p.symbol, { bid: p.bid, ask: p.ask });
      const epic = EPIC_MAP[p.symbol];
      if (epic) priceMap.set(epic, { bid: p.bid, ask: p.ask });
    }
  }

  // Fallback: fehlende Preise vom Python Backend holen
  const missingSyms = symbolsNeeded.filter(s => !priceMap.has(s));
  if (missingSyms.length > 0) {
    console.warn(`[trade-mgr] ⚠️ Preis fehlt für: ${missingSyms.join(", ")} — Fallback via Python Backend`);
    const pyPrices = await pyFetchPrices(missingSyms).catch(() => []);
    for (const p of pyPrices) {
      if (p.symbol && p.price != null && p.price > 0) {
        priceMap.set(p.symbol, { bid: p.price, ask: p.price });
        const epic = EPIC_MAP[p.symbol];
        if (epic) priceMap.set(epic, { bid: p.price, ask: p.price });
        console.log(`[trade-mgr] ✅ Python-Preis: ${p.symbol} mid=${p.price}`);
      }
    }
    const stillMissing = missingSyms.filter(s => !priceMap.has(s));
    if (stillMissing.length > 0) console.warn(`[trade-mgr] ❌ Preis nicht abrufbar: ${stillMissing.join(", ")}`);
  }

  // ── 4. ATR vom Python Backend holen (für ATR-basiertes Trailing) ─────────
  const atrMap = new Map<string, number>();
  const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
  if (PYTHON_BASE && symbolsNeeded.length > 0) {
    try {
      const atrRes = await fetch(`${PYTHON_BASE}/api/v1/talib/analyze/multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: symbolsNeeded, interval: "1h" }),
        signal: AbortSignal.timeout(15000),
      });
      if (atrRes.ok) {
        const atrData = await atrRes.json() as { results?: Record<string, { atr?: number }> };
        for (const [sym, ta] of Object.entries(atrData.results ?? {})) {
          if (ta.atr && ta.atr > 0) {
            atrMap.set(sym, ta.atr);
            console.log(`[trade-mgr] ATR ${sym}=${ta.atr.toFixed(5)}`);
          }
        }
      }
    } catch { /* non-fatal — Fallback auf slRange*0.5 im RiskAgent */ }
  }

  // ── 5. RiskAgent ausführen ────────────────────────────────────────────────
  await runRiskAgent({
    apiKey: session.apiKey,
    cst: session.cst,
    securityToken: session.securityToken,
    positions: posResult.positions,
    priceMap,
    dbMeta,
    atrMap,
  });
}
