/**
 * Active Trade Manager — Capital.com
 * Runs every 2min. Covers ALL live positions.
 *
 * Order of checks per position:
 *  1. Zeit-Exit   — close if position age > style limit
 *  2. Partial TP  — close 50% at 50% to TP (once only)
 *  3. Breakeven   — SL → entry when progress ≥ beAt
 *  4. Trailing SL — move SL up as price rises (only after BE)
 *
 * Confidence levels:
 *  ≥80: BE at 70%, Trail 40% of SL range
 *  ≥75: BE at 55%, Trail 50% of SL range
 *   <75: BE at 40%, Trail 60% of SL range
 */

import { getPrisma } from "../../app/lib/prisma";
import {
  capitalGetPrices, capitalUpdatePosition, capitalClosePosition,
  capitalClosePartial, capitalGetPositions, EPIC_MAP,
} from "./capital-com-client";
import { getCapitalSession, isCapitalConnected } from "./capital-com-session";

// Default SL range per symbol — used when position has no SL set
const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10,   XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  NAS100: 50, SPX500: 20, UK100: 30, GER40: 40, DJ30: 50, JPN225: 200,
  USOIL: 1.0, UKOIL: 1.0, NATGAS: 0.1,
  BTCUSD: 500, ETHUSD: 30,
};

// Breakeven tolerance per symbol — prevents false alreadyAtBE detection
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
  SCALPING:   4,
  DAYTRADING: 24,
  SWING:      168,
};

interface PosMeta {
  beSet: boolean;
  partialDone: boolean;
  trailSL: number | null;
  confidence: number;
  tradingStyle: string;
}
const positionMeta: Map<string, PosMeta> = new Map();

function getLevel(score: number): { beAt: number; trailDist: number } {
  if (score >= 80) return { beAt: 0.70, trailDist: 0.40 };
  if (score >= 75) return { beAt: 0.55, trailDist: 0.50 };
  return               { beAt: 0.40, trailDist: 0.60 };
}

export async function runActiveTradeManager(): Promise<void> {
  if (!isCapitalConnected()) return;
  const session = getCapitalSession()!;
  const db = getPrisma();

  // ── 1. Fetch all live positions ───────────────────────────────────────────
  const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
  console.log(`[trade-mgr] positions: ok=${posResult.ok} count=${posResult.positions?.length ?? 0}`);
  if (!posResult.ok || !posResult.positions?.length) return;

  // ── 2. Load DB metadata ───────────────────────────────────────────────────
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
          confidence:   m.confidence ?? 72,
          tradingStyle: m.tradingStyle ?? m.strategy ?? "DAYTRADING",
        });
      }
    } catch { /* skip */ }
  }

  // ── 3. Batch price fetch — alle Symbole auf einmal ────────────────────────
  // Nutze symbol aus Position, aber auch epic als Fallback für EPIC_MAP lookup
  const symbolsNeeded = [...new Set(
    posResult.positions.map(p => p.symbol).filter(Boolean)
  )];
  console.log(`[trade-mgr] price fetch symbols: ${symbolsNeeded.join(", ")}`);

  const priceResult = await capitalGetPrices(
    session.apiKey, session.cst, session.securityToken, symbolsNeeded
  ).catch(() => null);

  // Build priceMap — key by symbol AND by epic for fallback lookup
  const priceMap = new Map<string, { bid: number; ask: number }>();
  for (const p of priceResult?.prices ?? []) {
    if (p.symbol && (p.bid > 0 || p.ask > 0)) {
      priceMap.set(p.symbol, { bid: p.bid, ask: p.ask });
      // Also store by epic in case position returns epic as symbol
      const epic = EPIC_MAP[p.symbol];
      if (epic) priceMap.set(epic, { bid: p.bid, ask: p.ask });
    }
  }
  console.log(`[trade-mgr] priceMap keys: ${[...priceMap.keys()].join(", ") || "EMPTY"}`);

  // ── 4. Process each position ──────────────────────────────────────────────
  for (const pos of posResult.positions) {
    const dealId = pos.dealId;
    if (!dealId) continue;
    const entry = pos.openLevel;
    if (!entry || entry <= 0) continue;
    const isBuy = pos.direction === "BUY";

    // Symbol lookup — try symbol first, then epic
    const symbol = pos.symbol || pos.epic || "";
    const prices = priceMap.get(symbol) ?? priceMap.get(pos.epic ?? "");
    if (!prices) {
      console.log(`[trade-mgr] ⚠️ no price for ${symbol} (epic=${pos.epic}) — skipping`);
      continue;
    }
    const currentPrice = isBuy ? prices.bid : prices.ask;
    if (!currentPrice || currentPrice <= 0) continue;

    // Merge DB + in-memory meta
    const mem = positionMeta.get(dealId) ?? {
      beSet: false, partialDone: false, trailSL: null, confidence: 72, tradingStyle: "DAYTRADING"
    };
    const meta: PosMeta = dbMeta.get(dealId) ?? mem;

    const lvl = getLevel(meta.confidence);
    const liveSL = pos.stopLevel ?? 0;
    const liveTP = pos.profitLevel ?? 0;

    const slRange = liveSL > 0
      ? Math.abs(entry - liveSL)
      : (DEFAULT_SL_RANGE[symbol] ?? entry * 0.005); // 0.5% fallback
    const totalRange = liveTP > 0
      ? Math.abs(liveTP - entry)
      : slRange * 2;
    if (slRange < 0.000001) continue;

    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    // Symbol-specific BE tolerance (kein globales 0.0001 mehr)
    const beTol = BE_TOLERANCE[symbol] ?? slRange * 0.01;
    const alreadyAtBE = isBuy
      ? (liveSL > 0 && liveSL >= entry - beTol)
      : (liveSL > 0 && liveSL <= entry + beTol);
    const beEffective = meta.beSet || alreadyAtBE;
    const currentTrailSL = meta.trailSL ?? (liveSL > 0 ? liveSL : (isBuy ? entry - slRange : entry + slRange));

    console.log(`[trade-mgr] ${symbol} ${pos.direction} entry=${entry} current=${currentPrice} progress=${(progress*100).toFixed(1)}% beEff=${beEffective} SL=${liveSL}`);

    // ── Zeit-Exit ─────────────────────────────────────────────────────────
    const style = meta.tradingStyle.toUpperCase();
    const maxHours = STYLE_MAX_HOURS[style] ?? STYLE_MAX_HOURS.DAYTRADING;
    const openedAt = new Date(pos.createdDate ?? Date.now());
    const ageHours = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours >= maxHours) {
      const closeResult = await capitalClosePosition(session.apiKey, session.cst, session.securityToken, dealId);
      if (closeResult.ok) {
        positionMeta.delete(dealId);
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET status='CLOSED', result='CLOSED_TIME', "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $1`,
          `%${dealId}%`
        ).catch(() => {});
        console.log(`[trade-mgr] ⏰ Zeit-Exit: ${symbol} ${pos.direction} age=${ageHours.toFixed(1)}h (${style})`);
        try {
          const { notifyTradeExecuted } = await import("../telegram-notifications/telegram-sender");
          await notifyTradeExecuted({ symbol, direction: pos.direction, size: pos.size, entry, stopLoss: 0, takeProfit: 0, confidence: meta.confidence, broker: "Capital.com (Zeit-Exit)", dealId });
        } catch { /* non-fatal */ }
        continue;
      }
    }

    // ── Partial TP (50% close at 50% progress) ───────────────────────────
    if (!meta.partialDone && progress >= 0.50) {
      // pos.size kann 0 sein wenn Capital.com dealSize zurückgibt — beide prüfen
      const rawSize = pos.size > 0 ? pos.size : 0;
      const partialSize = rawSize >= 2 ? Math.floor(rawSize / 2) : 0;
      if (partialSize > 0) {
        const epicForClose = EPIC_MAP[symbol] ?? pos.epic ?? symbol;
        const partialResult = await capitalClosePartial(
          session.apiKey, session.cst, session.securityToken,
          epicForClose, pos.direction, partialSize
        );
        if (partialResult.ok) {
          positionMeta.set(dealId, { ...meta, partialDone: true });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $1`,
            `%${dealId}%`
          ).catch(() => {});
          console.log(`[trade-mgr] 💰 Partial TP: ${symbol} closed ${partialSize} of ${rawSize} at ${(progress*100)|0}% to TP`);
          try {
            const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
            await notifyBreakeven({ symbol, direction: pos.direction, entry, broker: "Capital.com (Partial TP)" });
          } catch { /* non-fatal */ }
        } else {
          console.log(`[trade-mgr] ⚠️ Partial TP failed: ${symbol} error=${partialResult.error}`);
        }
      } else {
        // Markiere als done wenn Size zu klein — verhindert endlose Versuche
        positionMeta.set(dealId, { ...meta, partialDone: true });
        console.log(`[trade-mgr] ⚠️ Partial TP skipped: ${symbol} size=${rawSize} too small`);
      }
    }

    // ── Breakeven ─────────────────────────────────────────────────────────
    if (!beEffective && progress >= lvl.beAt) {
      const newSL = entry;
      const upd = await capitalUpdatePosition(
        session.apiKey, session.cst, session.securityToken,
        dealId, newSL, liveTP > 0 ? liveTP : undefined
      );
      if (upd.ok) {
        positionMeta.set(dealId, { ...meta, beSet: true, trailSL: newSL });
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
          newSL, `%${dealId}%`
        ).catch(() => {});
        console.log(`[trade-mgr] ✅ Breakeven: ${symbol} ${pos.direction} entry=${entry} progress=${(progress*100).toFixed(0)}%`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol, direction: pos.direction, entry, broker: "Capital.com" });
        } catch { /* non-fatal */ }
        continue;
      } else {
        console.log(`[trade-mgr] ⚠️ Breakeven failed: ${symbol} error=${upd.error}`);
      }
    }

    // ── Trailing SL ───────────────────────────────────────────────────────
    if (beEffective || alreadyAtBE) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy ? currentPrice - trailDistance : currentPrice + trailDistance;
      const shouldUpdate = isBuy
        ? newTrailSL > currentTrailSL + beTol && newTrailSL >= entry
        : newTrailSL < currentTrailSL - beTol && newTrailSL <= entry;
      if (shouldUpdate) {
        const upd = await capitalUpdatePosition(
          session.apiKey, session.cst, session.securityToken,
          dealId, newTrailSL, liveTP > 0 ? liveTP : undefined
        );
        if (upd.ok) {
          positionMeta.set(dealId, { ...meta, beSet: true, trailSL: newTrailSL });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
            newTrailSL, `%${dealId}%`
          ).catch(() => {});
          console.log(`[trade-mgr] 📈 Trail SL: ${symbol} ${pos.direction} SL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        } else {
          console.log(`[trade-mgr] ⚠️ Trail SL failed: ${symbol} error=${upd.error}`);
        }
      }
    }
  }

  // ── Cleanup closed positions from memory ─────────────────────────────────
  const liveIds = new Set(posResult.positions.map(p => p.dealId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveIds.has(id)) positionMeta.delete(id);
  }
}
