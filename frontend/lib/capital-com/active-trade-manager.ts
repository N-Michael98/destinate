/**
 * Active Trade Manager
 * Runs every 2min via instrumentation.ts background monitor.
 * Covers ALL live Capital.com positions (not just DB-tracked).
 *
 * Breakeven / Trailing levels by confidence score:
 *   < 75:  BE at 40% to TP, Trail = 60% of SL range
 *   75-80: BE at 55% to TP, Trail = 50% of SL range
 *   80+:   BE at 70% to TP, Trail = 40% of SL range
 *
 * For positions without fixed SL/TP (Multiplikator):
 *   Uses default 30-pip SL range to determine trail distance.
 */

import { getPrisma } from "../../app/lib/prisma";
import { capitalGetPrices, capitalUpdatePosition, capitalGetPositions } from "./capital-com-client";
import { getCapitalSession, isCapitalConnected } from "./capital-com-session";

// Default SL range (in price units) per instrument when no fixed SL exists
const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10, XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  US100: 50, US500: 20, UK100: 30, GER40: 40,
  USOIL: 1.0, BRENT: 1.0,
};

// In-memory state per dealId (for positions not tracked in DB)
interface PosMeta { beSet: boolean; trailSL: number | null; confidence: number }
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

  // ── 1. Get all live positions from Capital.com ───────────────────────────
  const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
  if (!posResult.ok || !posResult.positions?.length) return;

  // ── 2. Load DB metadata (confidence, beSet, trailSL) ────────────────────
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
          beSet: m.beSet ?? false,
          trailSL: m.trailSL ?? null,
          confidence: m.confidence ?? 72,
        });
      }
    } catch { /* skip */ }
  }

  // ── 3. Fetch prices for all unique symbols in one batch ──────────────────
  const symbols = [...new Set(posResult.positions.map(p => p.symbol).filter(Boolean))];
  const priceResult = await capitalGetPrices(session.apiKey, session.cst, session.securityToken, symbols).catch(() => null);
  const priceMap = new Map<string, { bid: number; ask: number }>();
  for (const p of priceResult?.prices ?? []) {
    if (p.symbol) priceMap.set(p.symbol, { bid: p.bid, ask: p.ask });
  }

  // ── 4. Process each live position ────────────────────────────────────────
  for (const pos of posResult.positions) {
    const dealId = pos.dealId;
    if (!dealId) continue;

    const entry = pos.openLevel;
    if (!entry || entry <= 0) continue;

    const isBuy = pos.direction === "BUY";
    const symbol = pos.symbol ?? pos.epic ?? "";

    // Get current price
    const prices = priceMap.get(symbol);
    if (!prices) continue;
    const currentPrice = isBuy ? prices.bid : prices.ask;
    if (!currentPrice) continue;

    // Merge DB meta + in-memory meta (DB wins)
    const mem = positionMeta.get(dealId) ?? { beSet: false, trailSL: null, confidence: 72 };
    const meta: PosMeta = dbMeta.get(dealId) ?? mem;

    const lvl = getLevel(meta.confidence);

    // SL range: prefer fixed SL, fall back to default range for instrument
    const liveSL = pos.stopLevel ?? 0;
    const liveTP = pos.profitLevel ?? 0;
    const hasFixedSL = liveSL > 0;
    const hasFixedTP = liveTP > 0;

    // Calculate working SL range
    const slRange = hasFixedSL
      ? Math.abs(entry - liveSL)
      : (DEFAULT_SL_RANGE[symbol] ?? 0.005);

    // If neither fixed SL nor TP, determine progress by price movement vs default range
    const totalRange = hasFixedTP
      ? Math.abs(liveTP - entry)
      : slRange * 2; // default target = 2x risk

    if (slRange < 0.000001) continue;

    // Progress toward TP (0 = entry, 1 = TP, negative = losing)
    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    // Current effective SL: use live if available, otherwise trailSL from memory
    const effectiveSL = hasFixedSL ? liveSL : (meta.trailSL ?? (isBuy ? entry - slRange : entry + slRange));
    const currentTrailSL = meta.trailSL ?? effectiveSL;

    // Already at breakeven? (live SL >= entry for BUY)
    const alreadyAtBE = isBuy
      ? (liveSL > 0 && liveSL >= entry - 0.0001)
      : (liveSL > 0 && liveSL <= entry + 0.0001);
    const beEffective = meta.beSet || alreadyAtBE;

    // ── Breakeven ────────────────────────────────────────────────────────────
    if (!beEffective && progress >= lvl.beAt) {
      const newSL = entry;
      const updateResult = await capitalUpdatePosition(session.apiKey, session.cst, session.securityToken, dealId, newSL, liveTP > 0 ? liveTP : undefined);
      if (updateResult.ok) {
        const newMeta = { ...meta, beSet: true, trailSL: newSL };
        positionMeta.set(dealId, newMeta);
        // Update DB if matching trade exists
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
          newSL, `%${dealId}%`
        ).catch(() => {});
        console.log(`[trade-mgr] ✅ Breakeven: ${symbol} ${pos.direction} entry=${entry} progress=${(progress*100).toFixed(0)}%`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol, direction: pos.direction, entry, broker: "Capital.com" });
        } catch { /* non-fatal */ }
        continue; // don't also apply trailing this cycle
      } else {
        console.warn(`[trade-mgr] Breakeven FAILED: ${symbol} ${dealId} — ${updateResult.error}`);
      }
    }

    // ── Trailing SL ──────────────────────────────────────────────────────────
    // Only after breakeven (or when live SL already past entry)
    if (beEffective || alreadyAtBE) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy
        ? currentPrice - trailDistance
        : currentPrice + trailDistance;

      // Never move SL backward, never move behind entry for BE positions
      const minSL = beEffective ? entry : -Infinity;
      const shouldUpdate = isBuy
        ? newTrailSL > currentTrailSL && newTrailSL >= minSL
        : newTrailSL < currentTrailSL && newTrailSL <= (beEffective ? entry : Infinity);

      if (shouldUpdate) {
        const updateResult = await capitalUpdatePosition(session.apiKey, session.cst, session.securityToken, dealId, newTrailSL, liveTP > 0 ? liveTP : undefined);
        if (updateResult.ok) {
          positionMeta.set(dealId, { ...meta, beSet: true, trailSL: newTrailSL });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
            newTrailSL, `%${dealId}%`
          ).catch(() => {});
          console.log(`[trade-mgr] 📈 Trail SL: ${symbol} ${pos.direction} SL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        }
      }
    }
  }

  // ── 5. Cleanup memory for closed positions ───────────────────────────────
  const liveDealIds = new Set(posResult.positions.map(p => p.dealId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveDealIds.has(id)) positionMeta.delete(id);
  }
}
