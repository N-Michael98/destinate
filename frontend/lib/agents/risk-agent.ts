/**
 * RiskAgent — Zuständig für Breakeven, Trailing Stop und Partial TP
 *
 * Eigener AI Manager (Claude) bewertet jede Position und entscheidet:
 * - Soll BE jetzt gesetzt werden?
 * - Soll Trail angepasst werden?
 * - Soll Partial TP ausgelöst werden?
 *
 * Kommuniziert via Agent Bus mit anderen Agents.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentBus } from "./agent-bus";
import {
  capitalUpdatePosition,
  capitalClosePosition,
  capitalClosePartial,
  EPIC_MAP,
  type OpenPosition,
} from "../capital-com/capital-com-client";

const AGENT_ID = "RiskAgent";

// ── Typen ─────────────────────────────────────────────────────────────────────

export type LivePosition = OpenPosition;

export interface PosMeta {
  beSet: boolean;
  partialDone: boolean;
  trailSL: number | null;
  peakPrice: number | null;
  confidence: number;
  tradingStyle: string;
}

export interface PriceData {
  bid: number;
  ask: number;
}

export interface RiskAgentContext {
  apiKey: string;
  cst: string;
  securityToken: string;
  positions: LivePosition[];
  priceMap: Map<string, PriceData>;
  dbMeta: Map<string, PosMeta>;
  atrMap: Map<string, number>;
}

// ── Konfiguration ─────────────────────────────────────────────────────────────

const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10,   XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  NAS100: 50, SPX500: 20, UK100: 30, GER40: 40, DJ30: 50, JPN225: 200,
  USOIL: 1.0, UKOIL: 1.0, NATGAS: 0.1,
  BTCUSD: 500, ETHUSD: 30,
};

const BE_TOLERANCE: Record<string, number> = {
  XAUUSD: 0.5,   XAGUSD: 0.02,
  EURUSD: 0.0002, GBPUSD: 0.0002, USDJPY: 0.02, AUDUSD: 0.0002,
  USDCAD: 0.0002, USDCHF: 0.0002, GBPJPY: 0.02, EURJPY: 0.02,
  EURGBP: 0.0002, NZDUSD: 0.0002,
  NAS100: 2, SPX500: 1, UK100: 1, GER40: 2, DJ30: 5, JPN225: 10,
  USOIL: 0.05, UKOIL: 0.05, NATGAS: 0.005,
  BTCUSD: 10, ETHUSD: 1,
};

const STYLE_MAX_HOURS: Record<string, number> = {
  SCALPING: 4, DAYTRADING: 24, SWING: 168,
};

// Profit-%-Schwellen + ATR-Faktor nach Trading-Style
function getStyleThresholds(style: string): {
  bePct: number; partialPct: number; trailPct: number; atrFactor: number;
} {
  switch (style.toUpperCase()) {
    case "SCALPING":  return { bePct: 0.003, partialPct: 0.006, trailPct: 0.010, atrFactor: 1.0 };
    case "SWING":     return { bePct: 0.010, partialPct: 0.020, trailPct: 0.030, atrFactor: 2.5 };
    default:          return { bePct: 0.005, partialPct: 0.010, trailPct: 0.015, atrFactor: 1.5 };
  }
}

// ── In-Memory State ───────────────────────────────────────────────────────────

const positionMeta: Map<string, PosMeta> = new Map();

/**
 * Persistiert Risiko-Zustand in Trade.notes (Generalkontroll-Fund 28.07.).
 *
 * Vorher lebten beSet/partialDone/trailSL NUR in der obigen Map — die ist nach
 * jedem Redeploy/Neustart leer. active-trade-manager.ts LIEST zwar
 * dbMeta.partialDone aus notes, aber niemand hat es je GESCHRIEBEN. Folge:
 * nach einem Neustart galt "Teilgewinn noch nicht genommen" und der RiskAgent
 * hat bei weiterhin >= Schwelle ein ZWEITES Mal 50% geschlossen.
 * (Breakeven/Trailing waren nie betroffen — die prüfen zusätzlich den echten
 * Stop beim Broker über alreadyAtBE bzw. meta.trailSL ?? liveSL.)
 *
 * Merged NUR die übergebenen Felder in das bestehende notes-JSON — entryContext,
 * dealId, Slippage-Daten usw. bleiben unangetastet. Fire-and-forget + non-fatal:
 * ein DB-Problem darf den Trading-Zyklus niemals blockieren oder abbrechen.
 * "updatedAt" wird bewusst NICHT angefasst (Report-Zeiträume bleiben korrekt).
 */
function persistMeta(dealId: string, patch: Record<string, unknown>): void {
  (async () => {
    try {
      const { getPrisma } = await import("../../app/lib/prisma");
      const db = getPrisma();
      const rows = await (db.$queryRawUnsafe as (q: string, ...a: unknown[]) => Promise<Array<{ id: number; notes: string }>>)(
        `SELECT id, notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE $1 LIMIT 1`,
        `%"dealId":"${dealId}"%`
      );
      if (!rows?.length) return;
      let m: Record<string, unknown> = {};
      try { m = JSON.parse(rows[0].notes) as Record<string, unknown>; } catch { m = {}; }
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`,
        JSON.stringify({ ...m, ...patch }),
        rows[0].id
      );
    } catch (e) {
      console.warn(`[risk-agent] Risiko-Zustand nicht persistiert (deal=${dealId}):`, e instanceof Error ? e.message : String(e));
    }
  })();
}

// ── AI Manager ────────────────────────────────────────────────────────────────

let aiClient: Anthropic | null = null;

function getAI(): Anthropic {
  if (!aiClient) {
    aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return aiClient;
}

interface AIRiskDecision {
  action: "APPROVE" | "SKIP" | "ADJUST";
  adjustedBeBuffer?: number;  // Override 15% default wenn AI anders entscheidet
  reason: string;
}

async function askAIManager(
  symbol: string,
  direction: string,
  progress: number,
  confidence: number,
  action: "BREAKEVEN" | "TRAIL" | "PARTIAL_TP",
): Promise<AIRiskDecision> {
  try {
    const ai = getAI();
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `RiskAgent Entscheidung:
Symbol: ${symbol} ${direction}
Action: ${action}
Progress to TP: ${(progress * 100).toFixed(1)}%
Confidence: ${confidence}

Antworte NUR mit JSON: {"action":"APPROVE"|"SKIP"|"ADJUST","adjustedBeBuffer":0.15,"reason":"kurz"}
APPROVE = normal ausführen, SKIP = nicht jetzt, ADJUST = angepassten Buffer verwenden.`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (json) return JSON.parse(json) as AIRiskDecision;
  } catch (err) {
    console.warn(`[risk-agent] AI Manager nicht verfügbar — Rule-Based Fallback (${err})`);
  }
  // Fallback: immer approven (Rule-Based läuft weiter)
  return { action: "APPROVE", reason: "fallback" };
}

// ── Hauptlogik: Position verarbeiten ─────────────────────────────────────────

async function processPosition(
  pos: LivePosition,
  meta: PosMeta,
  prices: PriceData,
  ctx: RiskAgentContext,
): Promise<void> {
  const { apiKey, cst, securityToken } = ctx;
  const { dealId, direction, openLevel: entry, stopLevel, profitLevel, symbol, epic } = pos;
  const isBuy = direction === "BUY";
  const currentPrice = isBuy ? prices.bid : prices.ask;
  if (!currentPrice || currentPrice <= 0) return;

  const thresholds = getStyleThresholds(meta.tradingStyle);
  const liveSL = stopLevel != null ? stopLevel : 0;
  const liveTP = profitLevel != null ? profitLevel : 0;

  const slRange = liveSL > 0
    ? Math.abs(entry - liveSL)
    : (DEFAULT_SL_RANGE[symbol] ?? entry * 0.005);
  if (slRange < 0.000001) return;

  // Echter Profit in % — unabhängig von TP-Distanz
  const profitPct = isBuy
    ? (currentPrice - entry) / entry
    : (entry - currentPrice) / entry;

  // ATR vom Python Backend — Fallback auf slRange * 0.5
  const atr = ctx.atrMap.get(symbol) ?? ctx.atrMap.get(epic ?? "") ?? slRange * 0.5;

  const beTol = BE_TOLERANCE[symbol] ?? slRange * 0.01;
  const beZone = Math.max(beTol, slRange * 0.20);
  const alreadyAtBE = isBuy
    ? (liveSL > 0 && liveSL >= entry - beZone)
    : (liveSL > 0 && liveSL <= entry + beZone);
  const beEffective = meta.beSet || alreadyAtBE;
  // Generalkontroll-Fund C (03.08.): Bezugspunkt fürs Trailing war allein die
  // EIGENE Erinnerung (meta.trailSL), der echte Broker-Stop nur als Rückfall,
  // wenn gar keine Erinnerung vorlag. Der Python-Lifecycle bewegt denselben
  // Stop im selben 2-Minuten-Zyklus. Zog Python enger nach, wusste dieser
  // Agent nichts davon und konnte den Stop wieder zurückholen:
  // Erinnerung 105, Broker schon auf 108, neu berechnet 106 -> 106 > 105 ist
  // wahr, also wurde 106 geschrieben und die Absicherung von 108 auf 106
  // gelockert.
  // Jetzt gilt immer der ENGERE von beiden. Damit kann sich ein Stop nur noch
  // in Richtung Gewinn bewegen, egal welches System ihn zuletzt gesetzt hat.
  // (Der Breakeven-Block braucht das nicht: alreadyAtBE oben prüft bereits den
  // echten Broker-Stop und überspringt, wenn dieser schon abgesichert ist.)
  const trailFallback = liveSL > 0 ? liveSL : (isBuy ? entry - slRange : entry + slRange);
  const currentTrailSL = meta.trailSL == null
    ? trailFallback
    : (isBuy ? Math.max(meta.trailSL, trailFallback) : Math.min(meta.trailSL, trailFallback));

  console.log(`[risk-agent] ${symbol} ${direction} entry=${entry} cur=${currentPrice} profit=${(profitPct*100).toFixed(2)}% atr=${atr.toFixed(5)} be=${beEffective}`);

  // ── Zeit-Exit ──────────────────────────────────────────────────────────────
  const style = meta.tradingStyle.toUpperCase();
  const maxHours = STYLE_MAX_HOURS[style] ?? STYLE_MAX_HOURS.DAYTRADING;
  const ageHours = (Date.now() - new Date(pos.createdDate ?? Date.now()).getTime()) / 3_600_000;
  if (ageHours >= maxHours) {
    const closeResult = await capitalClosePosition(apiKey, cst, securityToken, dealId);
    if (closeResult.ok) {
      positionMeta.delete(dealId);
      agentBus.publish({
        type: "RISK:POSITION_CLOSED",
        agentId: AGENT_ID,
        timestamp: new Date().toISOString(),
        payload: { dealId, symbol, direction, reason: "ZEIT_EXIT", ageHours },
      });
      console.log(`[risk-agent] ⏰ Zeit-Exit: ${symbol} age=${ageHours.toFixed(1)}h`);
    }
    return;
  }

  // ── Partial TP — bei 1.0% Profit (Daytrading), 0.6% Scalping, 2.0% Swing ──
  if (!meta.partialDone && profitPct >= thresholds.partialPct) {
    const aiDecision = await askAIManager(symbol, direction, profitPct, meta.confidence, "PARTIAL_TP");

    if (aiDecision.action !== "SKIP") {
      const rawSize = pos.size > 0 ? pos.size : 0;
      const partialSize = rawSize >= 2 ? Math.floor(rawSize / 2) : 0;

      if (partialSize > 0) {
        const epicForClose = EPIC_MAP[symbol] ?? epic ?? symbol;
        const result = await capitalClosePartial(apiKey, cst, securityToken, epicForClose, direction, partialSize);
        if (result.ok) {
          positionMeta.set(dealId, { ...meta, partialDone: true });
          persistMeta(dealId, { partialDone: true });
          agentBus.publish({
            type: "RISK:PARTIAL_TP",
            agentId: AGENT_ID,
            timestamp: new Date().toISOString(),
            payload: { dealId, symbol, direction, partialSize, profitPct, aiReason: aiDecision.reason },
          });
          console.log(`[risk-agent] 💰 Partial TP: ${symbol} ${partialSize}/${rawSize} profit=${(profitPct*100).toFixed(2)}% (AI: ${aiDecision.reason})`);
        }
      } else {
        // Position zu klein zum Halbieren — als erledigt merken, damit es nicht
        // jeden Zyklus erneut versucht wird (auch über Neustarts hinweg).
        positionMeta.set(dealId, { ...meta, partialDone: true });
        persistMeta(dealId, { partialDone: true });
      }
    }
  }

  // ── Breakeven — bei 0.5% Profit (Daytrading), 0.3% Scalping, 1.0% Swing ──
  if (!beEffective && profitPct >= thresholds.bePct) {
    const aiDecision = await askAIManager(symbol, direction, profitPct, meta.confidence, "BREAKEVEN");

    // AI kann BE-Buffer anpassen (default 15%)
    const beBufferRatio = aiDecision.action === "ADJUST" && aiDecision.adjustedBeBuffer != null
      ? aiDecision.adjustedBeBuffer
      : 0.15;

    if (aiDecision.action !== "SKIP") {
      const beBuffer = slRange * beBufferRatio;
      const newSL = isBuy ? entry - beBuffer : entry + beBuffer;

      const upd = await capitalUpdatePosition(apiKey, cst, securityToken, dealId, newSL, liveTP > 0 ? liveTP : undefined);
      if (upd.ok) {
        positionMeta.set(dealId, { ...meta, beSet: true, trailSL: newSL });
        persistMeta(dealId, { beSet: true, trailSL: newSL });
        agentBus.publish({
          type: "RISK:BE_SET",
          agentId: AGENT_ID,
          timestamp: new Date().toISOString(),
          payload: { dealId, symbol, direction, entry, newSL, beBuffer, profitPct, aiReason: aiDecision.reason },
        });
        console.log(`[risk-agent] ✅ BE: ${symbol} SL=${newSL.toFixed(5)} (buffer=${(beBufferRatio*100).toFixed(0)}% AI:${aiDecision.reason})`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol, direction, entry, broker: "Capital.com" });
        } catch { /* non-fatal */ }
        return;
      }
    } else {
      console.log(`[risk-agent] ⏸ BE übersprungen: ${symbol} (AI: ${aiDecision.reason})`);
    }
  }

  // ── ATR Trailing Stop — ab 1.5% Profit (Daytrading), 1.0% Scalping, 3.0% Swing ──
  if (profitPct >= thresholds.trailPct) {
    const prevPeak = meta.peakPrice ?? currentPrice;
    const newPeak = isBuy ? Math.max(prevPeak, currentPrice) : Math.min(prevPeak, currentPrice);

    // ATR-basierte Trail-Distanz (1.5× ATR für Daytrading)
    const trailDistance = atr * thresholds.atrFactor;
    const newTrailSL = isBuy
      ? Math.max(newPeak - trailDistance, entry)
      : Math.min(newPeak + trailDistance, entry);

    const shouldUpdate = isBuy
      ? newTrailSL > currentTrailSL + beTol
      : newTrailSL < currentTrailSL - beTol;

    if (shouldUpdate) {
      const aiDecision = await askAIManager(symbol, direction, profitPct, meta.confidence, "TRAIL");

      if (aiDecision.action !== "SKIP") {
        const upd = await capitalUpdatePosition(apiKey, cst, securityToken, dealId, newTrailSL, liveTP > 0 ? liveTP : undefined);
        if (upd.ok) {
          positionMeta.set(dealId, { ...meta, beSet: newTrailSL >= entry, peakPrice: newPeak, trailSL: newTrailSL });
          persistMeta(dealId, { beSet: newTrailSL >= entry, peakPrice: newPeak, trailSL: newTrailSL });
          agentBus.publish({
            type: "RISK:TRAIL_UPDATED",
            agentId: AGENT_ID,
            timestamp: new Date().toISOString(),
            payload: { dealId, symbol, direction, newTrailSL, newPeak, atr, aiReason: aiDecision.reason },
          });
          console.log(`[risk-agent] 📈 ATR Trail: ${symbol} peak=${newPeak.toFixed(5)} SL=${newTrailSL.toFixed(5)} ATR=${atr.toFixed(5)}×${thresholds.atrFactor}`);
        }
      }
    } else if (newPeak !== prevPeak) {
      positionMeta.set(dealId, { ...meta, peakPrice: newPeak });
    }
  }
}

// ── Öffentliche API ───────────────────────────────────────────────────────────

export async function runRiskAgent(ctx: RiskAgentContext): Promise<void> {
  console.log(`[risk-agent] gestartet — ${ctx.positions.length} Positionen`);

  for (const pos of ctx.positions) {
    if (!pos.dealId || !pos.openLevel) continue;

    const symbol = pos.symbol || pos.epic || "";
    const prices = ctx.priceMap.get(symbol) ?? ctx.priceMap.get(pos.epic ?? "");
    if (!prices) {
      console.log(`[risk-agent] ⚠️ kein Preis für ${symbol} — übersprungen`);
      continue;
    }

    const mem = positionMeta.get(pos.dealId) ?? {
      beSet: false, partialDone: false, trailSL: null, peakPrice: null, confidence: 72, tradingStyle: "DAYTRADING"
    };
    // Merge DB + in-memory: für Booleans (beSet, partialDone) gewinnt TRUE aus beiden Quellen.
    // DB schreibt beSet/partialDone nie zurück → in-memory-State darf nicht verloren gehen.
    const dbEntry = ctx.dbMeta.get(pos.dealId);
    const meta: PosMeta = {
      beSet:        (dbEntry?.beSet || mem.beSet),
      partialDone:  (dbEntry?.partialDone || mem.partialDone),
      trailSL:      dbEntry?.trailSL ?? mem.trailSL,
      peakPrice:    dbEntry?.peakPrice ?? mem.peakPrice,
      confidence:   dbEntry?.confidence ?? mem.confidence,
      tradingStyle: dbEntry?.tradingStyle ?? mem.tradingStyle,
    };

    try {
      await processPosition(pos, meta, prices, ctx);
    } catch (err) {
      console.error(`[risk-agent] ❌ Fehler bei ${symbol}:`, err);
      agentBus.publish({
        type: "RISK:ERROR",
        agentId: AGENT_ID,
        timestamp: new Date().toISOString(),
        payload: { dealId: pos.dealId, symbol, error: String(err) },
      });
    }
  }

  // Cleanup abgeschlossene Positionen
  const liveIds = new Set(ctx.positions.map(p => p.dealId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveIds.has(id)) positionMeta.delete(id);
  }

  console.log(`[risk-agent] Zyklus abgeschlossen`);
}

export function getRiskAgentState(): Map<string, PosMeta> {
  return new Map(positionMeta);
}
