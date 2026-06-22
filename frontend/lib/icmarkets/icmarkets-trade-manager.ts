/**
 * Active Trade Manager — IC Markets (cTrader)
 * Runs every 2min. Covers ALL live positions.
 *
 * Order of checks per position:
 *  1. Zeit-Exit   — close if position age > style limit
 *  2. Partial TP  — close 50% at 50% to TP (once only)
 *  3. Breakeven   — SL → entry when progress ≥ beAt
 *  4. Trailing SL — move SL up as price rises (only after BE)
 *
 * Zeit-Exit limits:
 *  SCALPING:   4 hours
 *  DAYTRADING: 24 hours
 *  SWING:      168 hours (7 days)
 */

import { getPrisma } from "../../app/lib/prisma";
import { icGetPositions, icUpdatePosition, icClosePosition, icClosePartial, icGetPrice } from "./icmarkets-client";
import { isICMarketsConnected } from "./icmarkets-session";

const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10, XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  USTEC: 50, US500: 20, UK100: 30, DE40: 40,
  WTI: 1.0, BRENT: 1.0,
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

export async function runICMarketsTradeManager(): Promise<void> {
  if (!isICMarketsConnected()) return;
  const db = getPrisma();

  // ── 1. Get all live positions ─────────────────────────────────────────────
  const posResult = await icGetPositions();
  if (!posResult.ok || !posResult.positions?.length) return;

  // ── 2. Load DB metadata ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbTrades = await (db.$queryRawUnsafe as any)(
    `SELECT notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%icPositionId%'`
  ) as Array<{ notes: string }>;

  const dbMeta = new Map<string, PosMeta>();
  for (const t of dbTrades) {
    try {
      const m = JSON.parse(t.notes);
      if (m.icPositionId) {
        dbMeta.set(String(m.icPositionId), {
          beSet:       m.icBeSet ?? m.beSet ?? false,
          partialDone: m.icPartialDone ?? m.partialDone ?? false,
          trailSL:     m.icTrailSL ?? m.trailSL ?? null,
          confidence:  m.confidence ?? 72,
          tradingStyle: m.tradingStyle ?? m.strategy ?? "DAYTRADING",
        });
      }
    } catch { /* skip */ }
  }

  // ── 3. Process each position ──────────────────────────────────────────────
  for (const pos of posResult.positions) {
    const positionId = pos.positionId;
    if (!positionId) continue;
    const entry = pos.openPrice;
    if (!entry || entry <= 0) continue;
    const isBuy = pos.direction === "BUY";
    const symbol = pos.symbol;

    // Get price (per position — IC Markets has no batch API)
    const priceResult = await icGetPrice(symbol).catch(() => null);
    if (!priceResult?.ok) continue;
    const currentPrice = isBuy ? (priceResult.bid ?? 0) : (priceResult.ask ?? 0);
    if (!currentPrice) continue;

    const mem = positionMeta.get(positionId) ?? { beSet: false, partialDone: false, trailSL: null, confidence: 72, tradingStyle: "DAYTRADING" };
    const meta: PosMeta = dbMeta.get(positionId) ?? mem;

    const lvl = getLevel(meta.confidence);
    const liveSL = pos.stopLoss ?? 0;
    const liveTP = pos.takeProfit ?? 0;

    const slRange = liveSL > 0
      ? Math.abs(entry - liveSL)
      : (DEFAULT_SL_RANGE[symbol] ?? 0.005);
    const totalRange = liveTP > 0
      ? Math.abs(liveTP - entry)
      : slRange * 2;
    if (slRange < 0.000001) continue;

    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    const alreadyAtBE = isBuy
      ? (liveSL > 0 && liveSL >= entry - 0.0001)
      : (liveSL > 0 && liveSL <= entry + 0.0001);
    const beEffective = meta.beSet || alreadyAtBE;
    const currentTrailSL = meta.trailSL ?? (liveSL > 0 ? liveSL : (isBuy ? entry - slRange : entry + slRange));

    // ── Zeit-Exit ─────────────────────────────────────────────────────────
    const style = meta.tradingStyle.toUpperCase();
    const maxHours = STYLE_MAX_HOURS[style] ?? STYLE_MAX_HOURS.DAYTRADING;
    const openedAt = new Date(pos.openTime ?? Date.now());
    const ageHours = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours >= maxHours) {
      const closeResult = await icClosePosition(positionId);
      if (closeResult.ok) {
        positionMeta.delete(positionId);
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET status='CLOSED', result='CLOSED_TIME', "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $1`,
          `%${positionId}%`
        ).catch(() => {});
        console.log(`[ic-trade-mgr] ⏰ Zeit-Exit: ${symbol} ${pos.direction} age=${ageHours.toFixed(1)}h limit=${maxHours}h (${style})`);
        continue;
      }
    }

    // ── Partial TP (50% close at 50% progress) ───────────────────────────
    if (!meta.partialDone && progress >= 0.50 && pos.volume > 0) {
      const partialVol = Math.floor(pos.volume / 2);
      if (partialVol > 0) {
        const partialResult = await icClosePartial(positionId, partialVol);
        if (partialResult.ok) {
          positionMeta.set(positionId, { ...meta, partialDone: true });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $1`,
            `%${positionId}%`
          ).catch(() => {});
          console.log(`[ic-trade-mgr] 💰 Partial TP: ${symbol} closed ${partialVol} of ${pos.volume} at ${(progress*100)|0}% to TP`);
        }
      }
    }

    // ── Breakeven ─────────────────────────────────────────────────────────
    if (!beEffective && progress >= lvl.beAt) {
      const newSL = entry;
      const upd = await icUpdatePosition(positionId, newSL, liveTP > 0 ? liveTP : undefined);
      if (upd.ok) {
        positionMeta.set(positionId, { ...meta, beSet: true, trailSL: newSL });
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
          newSL, `%${positionId}%`
        ).catch(() => {});
        console.log(`[ic-trade-mgr] ✅ Breakeven: ${symbol} ${pos.direction} entry=${entry} progress=${(progress*100).toFixed(0)}%`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol, direction: pos.direction, entry, broker: "IC Markets" });
        } catch { /* non-fatal */ }
        continue;
      }
    }

    // ── Trailing SL ───────────────────────────────────────────────────────
    if (beEffective || alreadyAtBE) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy ? currentPrice - trailDistance : currentPrice + trailDistance;
      const shouldUpdate = isBuy
        ? newTrailSL > currentTrailSL && newTrailSL >= entry
        : newTrailSL < currentTrailSL && newTrailSL <= entry;
      if (shouldUpdate) {
        const upd = await icUpdatePosition(positionId, newTrailSL, liveTP > 0 ? liveTP : undefined);
        if (upd.ok) {
          positionMeta.set(positionId, { ...meta, beSet: true, trailSL: newTrailSL });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
            newTrailSL, `%${positionId}%`
          ).catch(() => {});
          console.log(`[ic-trade-mgr] 📈 Trail SL: ${symbol} ${pos.direction} SL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        }
      }
    }
  }

  // ── Cleanup closed positions ──────────────────────────────────────────────
  const liveIds = new Set(posResult.positions.map(p => p.positionId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveIds.has(id)) positionMeta.delete(id);
  }
}
