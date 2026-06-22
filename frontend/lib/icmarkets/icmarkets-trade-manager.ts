/**
 * IC Markets Active Trade Manager
 * Runs every 2min via instrumentation.ts background monitor.
 * Covers ALL live cTrader positions — not just DB-tracked ones.
 *
 * Breakeven / Trailing levels by confidence:
 *   < 75:  BE at 40% to TP, Trail = 60% of SL range
 *   75-80: BE at 55% to TP, Trail = 50% of SL range
 *   80+:   BE at 70% to TP, Trail = 40% of SL range
 */

import { getPrisma } from "../../app/lib/prisma";
import { icGetPositions, icUpdatePosition, icGetPrice } from "./icmarkets-client";
import { isICMarketsConnected } from "./icmarkets-session";

// Default SL range per instrument when no fixed SL exists (absolute price units)
const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10, XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  USTEC: 50, US500: 20, UK100: 30, DE40: 40,
  WTI: 1.0, BRENT: 1.0,
};

// In-memory state per positionId (for positions not tracked in DB)
interface PosMeta { beSet: boolean; trailSL: number | null; confidence: number }
const positionMeta: Map<string, PosMeta> = new Map();

function getLevel(score: number): { beAt: number; trailDist: number } {
  if (score >= 80) return { beAt: 0.70, trailDist: 0.40 };
  if (score >= 75) return { beAt: 0.55, trailDist: 0.50 };
  return               { beAt: 0.40, trailDist: 0.60 };
}

export async function runICMarketsTradeManager(): Promise<void> {
  if (!isICMarketsConnected()) return;
  const db = getPrisma();

  // ── 1. Get all live IC Markets positions ─────────────────────────────────
  const posResult = await icGetPositions();
  if (!posResult.ok || !posResult.positions?.length) return;

  // ── 2. Load DB metadata (confidence, beSet, trailSL per icPositionId) ───
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
          beSet: m.icBeSet ?? m.beSet ?? false,
          trailSL: m.icTrailSL ?? m.trailSL ?? null,
          confidence: m.confidence ?? 72,
        });
      }
    } catch { /* skip */ }
  }

  // ── 3. Process each live position ────────────────────────────────────────
  for (const pos of posResult.positions) {
    const positionId = pos.positionId;
    if (!positionId) continue;

    const entry = pos.openPrice;
    if (!entry || entry <= 0) continue;

    const isBuy = pos.direction === "BUY";
    const symbol = pos.symbol; // already cTrader name (e.g. "XAUUSD", "USTEC")

    // Get current price from cTrader
    const priceResult = await icGetPrice(symbol).catch(() => null);
    if (!priceResult?.ok) continue;
    const currentPrice = isBuy ? (priceResult.bid ?? 0) : (priceResult.ask ?? 0);
    if (!currentPrice) continue;

    // Merge DB meta + in-memory meta
    const mem = positionMeta.get(positionId) ?? { beSet: false, trailSL: null, confidence: 72 };
    const meta: PosMeta = dbMeta.get(positionId) ?? mem;

    const lvl = getLevel(meta.confidence);

    // SL/TP from live position
    const liveSL = pos.stopLoss ?? 0;
    const liveTP = pos.takeProfit ?? 0;

    // SL range: prefer fixed SL, fall back to default for instrument
    const slRange = liveSL > 0
      ? Math.abs(entry - liveSL)
      : (DEFAULT_SL_RANGE[symbol] ?? 0.005);

    const totalRange = liveTP > 0
      ? Math.abs(liveTP - entry)
      : slRange * 2;

    if (slRange < 0.000001) continue;

    // Progress toward TP (0 = entry, 1 = full TP, negative = losing)
    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    // Effective SL for trailing calculations
    const effectiveSL = liveSL > 0 ? liveSL : (meta.trailSL ?? (isBuy ? entry - slRange : entry + slRange));
    const currentTrailSL = meta.trailSL ?? effectiveSL;

    // Already at breakeven?
    const alreadyAtBE = isBuy
      ? (liveSL > 0 && liveSL >= entry - 0.0001)
      : (liveSL > 0 && liveSL <= entry + 0.0001);
    const beEffective = meta.beSet || alreadyAtBE;

    // ── Breakeven ────────────────────────────────────────────────────────────
    if (!beEffective && progress >= lvl.beAt) {
      const newSL = entry;
      const updateResult = await icUpdatePosition(positionId, newSL, liveTP > 0 ? liveTP : undefined);
      if (updateResult.ok) {
        const newMeta = { ...meta, beSet: true, trailSL: newSL };
        positionMeta.set(positionId, newMeta);
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
      } else {
        console.warn(`[ic-trade-mgr] Breakeven FAILED: ${symbol} ${positionId} — ${updateResult.error}`);
      }
    }

    // ── Trailing SL ──────────────────────────────────────────────────────────
    if (beEffective || alreadyAtBE) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy
        ? currentPrice - trailDistance
        : currentPrice + trailDistance;

      const shouldUpdate = isBuy
        ? newTrailSL > currentTrailSL && newTrailSL >= entry
        : newTrailSL < currentTrailSL && newTrailSL <= entry;

      if (shouldUpdate) {
        const updateResult = await icUpdatePosition(positionId, newTrailSL, liveTP > 0 ? liveTP : undefined);
        if (updateResult.ok) {
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

  // ── 4. Cleanup memory for closed positions ───────────────────────────────
  const liveIds = new Set(posResult.positions.map(p => p.positionId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveIds.has(id)) positionMeta.delete(id);
  }
}
