/**
 * Active Trade Manager
 * Runs every 2min via instrumentation.ts background monitor.
 * Works on ALL live Capital.com positions — not just DB-tracked ones.
 *
 * Breakeven / Trailing levels by confidence score:
 *   < 75 (high risk):   BE at 40% to TP, Trail at 60% SL dist
 *   75-80 (medium):     BE at 55% to TP, Trail at 50% SL dist
 *   80+   (low risk):   BE at 70% to TP, Trail at 40% SL dist
 */

import { getPrisma } from "../../app/lib/prisma";
import { capitalGetPrices, capitalUpdatePosition, capitalClosePosition, capitalGetPositions } from "./capital-com-client";
import { getCapitalSession, isCapitalConnected } from "./capital-com-session";

// In-memory state for positions not in DB: dealId → {beSet, trailSL, confidence}
const positionMeta: Map<string, { beSet: boolean; trailSL: number | null; confidence: number }> = new Map();

function getLevel(score: number): { beAt: number; trailDist: number } {
  if (score >= 80) return { beAt: 0.70, trailDist: 0.40 };
  if (score >= 75) return { beAt: 0.55, trailDist: 0.50 };
  return               { beAt: 0.40, trailDist: 0.60 };
}

export async function runActiveTradeManager(): Promise<void> {
  if (!isCapitalConnected()) return;
  const session = getCapitalSession()!;
  const db = getPrisma();

  // ── Fetch ALL live positions from Capital.com ────────────────────────────
  const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
  if (!posResult.ok || !posResult.positions?.length) return;

  // Load DB trades with dealId → confidence score map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbTrades = await (db.$queryRawUnsafe as any)(
    `SELECT notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%dealId%'`
  ) as Array<{ notes: string }>;

  const dbConfidenceByDealId: Map<string, number> = new Map();
  const dbBeSetByDealId: Map<string, boolean> = new Map();
  const dbTrailSLByDealId: Map<string, number | null> = new Map();
  for (const t of dbTrades) {
    try {
      const m = JSON.parse(t.notes);
      if (m.dealId) {
        dbConfidenceByDealId.set(m.dealId, m.confidence ?? 72);
        dbBeSetByDealId.set(m.dealId, m.beSet ?? false);
        dbTrailSLByDealId.set(m.dealId, m.trailSL ?? null);
      }
    } catch { /* skip */ }
  }

  // ── Process each live position ───────────────────────────────────────────
  for (const pos of posResult.positions) {
    const dealId = pos.dealId;
    if (!dealId) continue;

    const entry = pos.openLevel;
    const currentSLLive = pos.stopLevel ?? 0;
    const currentTP = pos.profitLevel ?? 0;
    if (!entry || entry <= 0) continue;
    // Need both SL and TP to apply logic
    if (currentSLLive <= 0 || currentTP <= 0) continue;

    // Direction
    const isBuy = (pos.direction ?? "").toUpperCase() === "BUY";

    // Get current price via epic → symbol lookup
    const epic = pos.epic ?? "";
    // Try to get price using epic directly (Capital.com also accepts epic in some endpoints)
    const priceResult = await capitalGetPrices(session.apiKey, session.cst, session.securityToken, [epic]).catch(() => null);
    if (!priceResult?.ok || !priceResult.prices?.length) continue;

    const latest = priceResult.prices[0];
    const currentPrice = isBuy ? (latest.bid ?? 0) : (latest.ask ?? 0);
    if (!currentPrice) continue;

    // Confidence + meta: DB first, then in-memory, then default
    const confidence = dbConfidenceByDealId.get(dealId) ?? positionMeta.get(dealId)?.confidence ?? 72;
    const memMeta = positionMeta.get(dealId) ?? { beSet: false, trailSL: null, confidence };
    const beSet = dbBeSetByDealId.get(dealId) ?? memMeta.beSet;
    const trailSL = dbTrailSLByDealId.get(dealId) ?? memMeta.trailSL;

    const lvl = getLevel(confidence);

    // SL used for logic = live SL (Capital.com is source of truth)
    const effectiveSL = currentSLLive > 0 ? currentSLLive : (trailSL ?? 0);

    const totalRange = Math.abs(currentTP - entry);
    const slRange = Math.abs(entry - effectiveSL);
    if (totalRange < 0.000001 || slRange < 0.000001) continue;

    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    const currentTrailSL = trailSL ?? effectiveSL;

    // ── Breakeven ──────────────────────────────────────────────────────────
    if (!beSet && progress >= lvl.beAt) {
      const newSL = entry;
      const updateResult = await capitalUpdatePosition(session.apiKey, session.cst, session.securityToken, dealId, newSL);
      if (updateResult.ok) {
        positionMeta.set(dealId, { ...memMeta, beSet: true, trailSL: newSL, confidence });
        // Update DB if we have a matching trade
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW()
           WHERE status='OPEN' AND notes LIKE $2`,
          newSL, `%${dealId}%`
        ).catch(() => {});
        console.log(`[trade-mgr] Breakeven: ${epic} ${pos.direction} entry=${entry} progress=${(progress*100).toFixed(0)}% confidence=${confidence}`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol: epic, direction: isBuy ? "BUY" : "SELL", entry, broker: "Capital.com" });
        } catch { /* non-fatal */ }
      }
      continue;
    }

    // ── Trailing SL ────────────────────────────────────────────────────────
    // Only after breakeven is set (live SL >= entry for BUY, <= entry for SELL)
    const breakevenReached = isBuy ? currentSLLive >= entry - 0.0001 : currentSLLive <= entry + 0.0001;
    if (beSet || breakevenReached) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy ? currentPrice - trailDistance : currentPrice + trailDistance;

      const shouldUpdate = isBuy ? newTrailSL > currentTrailSL : newTrailSL < currentTrailSL;
      if (shouldUpdate) {
        const updateResult = await capitalUpdatePosition(session.apiKey, session.cst, session.securityToken, dealId, newTrailSL);
        if (updateResult.ok) {
          positionMeta.set(dealId, { ...memMeta, beSet: true, trailSL: newTrailSL, confidence });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW()
             WHERE status='OPEN' AND notes LIKE $2`,
            newTrailSL, `%${dealId}%`
          ).catch(() => {});
          console.log(`[trade-mgr] Trail SL: ${epic} newSL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        }
      }
    }
  }

  // ── Cleanup in-memory state for closed positions ─────────────────────────
  const liveDealIds = new Set(posResult.positions.map(p => p.dealId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveDealIds.has(id)) positionMeta.delete(id);
  }
}
