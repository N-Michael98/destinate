/**
 * Active Trade Manager
 * Runs every 60s via the background monitor.
 * For each open trade: checks current P&L vs entry/SL/TP and applies
 * 3-level breakeven + trailing SL + early exit based on confidence score.
 *
 * Level thresholds (confidence score):
 *   70-75 (high risk):   BE at 40% to TP, Trail at 60% SL dist, Exit at -30% SL
 *   75-80 (medium risk): BE at 55% to TP, Trail at 50% SL dist, Exit at -50% SL
 *   80+   (low risk):    BE at 70% to TP, Trail at 40% SL dist, Exit at -70% SL
 */

import { getPrisma } from "../../app/lib/prisma";
import { capitalGetPrices, capitalUpdatePosition, capitalClosePosition, capitalGetPositions, EPIC_MAP } from "./capital-com-client";
import { getCapitalSession, isCapitalConnected } from "./capital-com-session";

// Reverse map: epic → symbol (for capitalGetPrices which needs symbols)
const EPIC_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(EPIC_MAP).map(([sym, epic]) => [epic, sym])
);

interface TradeMeta {
  dealId?: string;
  confidence?: number;
  beSet?: boolean;       // breakeven already applied
  trailActive?: boolean; // trailing already started
  trailSL?: number;      // current trailing SL level
}

interface OpenTrade {
  id: number;
  market: string;
  direction: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  notes: string;
}

function getLevel(score: number): { beAt: number; trailDist: number; exitAt: number } {
  if (score >= 80) return { beAt: 0.70, trailDist: 0.40, exitAt: 0.70 };
  if (score >= 75) return { beAt: 0.55, trailDist: 0.50, exitAt: 0.50 };
  return               { beAt: 0.40, trailDist: 0.60, exitAt: 0.30 };
}

export async function runActiveTradeManager(): Promise<void> {
  if (!isCapitalConnected()) return;
  const session = getCapitalSession()!;
  const db = getPrisma();

  // Get live positions from Capital.com to get real position dealId + openLevel + current SL/TP
  const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
  if (!posResult.ok) return;

  // Map: workingOrderId (what DB stores) OR positionDealId → live position data
  const livePositions = new Map<string, { dealId: string; openLevel: number; stopLevel: number; limitLevel: number; epic: string; direction: string }>();
  for (const p of posResult.positions ?? []) {
    const entry = { dealId: p.dealId, openLevel: p.openLevel, stopLevel: p.stopLevel ?? 0, limitLevel: p.profitLevel ?? 0, epic: p.epic, direction: p.direction };
    if (p.dealId) livePositions.set(p.dealId, entry);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openTrades = await (db.$queryRawUnsafe as any)(
    `SELECT id, market, direction, entry, "stopLoss", "takeProfit", notes
     FROM "Trade"
     WHERE status = 'OPEN'
       AND "stopLoss" > 0
       AND "takeProfit" > 0
       AND notes LIKE '%dealId%'`
  ) as OpenTrade[];

  for (const trade of openTrades) {
    let meta: TradeMeta = {};
    try { meta = JSON.parse(trade.notes); } catch { continue; }
    if (!meta.dealId) continue;

    // Find live position (DB stores workingOrderId, Capital.com positions have both)
    const livePos = livePositions.get(meta.dealId);
    if (!livePos) continue; // position already closed or not found

    // Use live position's real dealId for API calls (not DB's working order id)
    const positionDealId = livePos.dealId;

    // Get current price — trade.market is epic (e.g. "US100"), need symbol (e.g. "NAS100")
    const symbol = EPIC_TO_SYMBOL[trade.market] ?? trade.market;
    const priceResult = await capitalGetPrices(session.apiKey, session.cst, session.securityToken, [symbol]);
    if (!priceResult.ok || !priceResult.prices?.length) continue;

    const latest = priceResult.prices[0];
    const currentPrice = trade.direction === "BUY" ? latest.bid : latest.ask;
    if (!currentPrice) continue;

    // Use live entry from Capital.com if DB entry is 0
    const entry = trade.entry > 0 ? trade.entry : livePos.openLevel;
    const stopLoss = trade.stopLoss;
    const takeProfit = trade.takeProfit;
    if (!entry) continue;
    const isBuy = trade.direction === "BUY";

    // Distance from entry to TP (total target range)
    const totalRange = Math.abs(takeProfit - entry);
    const slRange = Math.abs(entry - stopLoss);
    if (totalRange < 0.00001 || slRange < 0.00001) continue;

    // How far price has moved toward TP (can be negative = moving against)
    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    // Current P&L as fraction of SL distance (negative = losing)
    const pnlFraction = isBuy
      ? (currentPrice - entry) / slRange
      : (entry - currentPrice) / slRange;

    const score = meta.confidence ?? 72;
    const lvl = getLevel(score);
    const currentSL = meta.trailSL ?? stopLoss;

    // ── Early Exit ────────────────────────────────────────────────────────────
    // If price moved against us by more than exitAt × SL distance and BE not set yet
    if (!meta.beSet && pnlFraction < -lvl.exitAt) {
      const closeResult = await capitalClosePosition(session.apiKey, session.cst, session.securityToken, positionDealId);
      if (closeResult.ok) {
        const updatedMeta = { ...meta, closedBy: "active-manager-early-exit", closedAt: new Date().toISOString() };
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET status='CLOSED', result='LOSS', notes=$1, "updatedAt"=NOW() WHERE id=$2`,
          JSON.stringify(updatedMeta), trade.id
        );
        console.log(`[trade-mgr] Early exit: ${trade.market} ${trade.direction} pnlFraction=${pnlFraction.toFixed(2)} score=${score}`);
      }
      continue;
    }

    // ── Breakeven ─────────────────────────────────────────────────────────────
    if (!meta.beSet && progress >= lvl.beAt) {
      const newSL = entry; // SL → Entry = breakeven
      const updateResult = await capitalUpdatePosition(session.apiKey, session.cst, session.securityToken, positionDealId, newSL);
      if (updateResult.ok) {
        const updatedMeta = { ...meta, beSet: true, trailActive: false, trailSL: newSL };
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "stopLoss"=$1, notes=$2, "updatedAt"=NOW() WHERE id=$3`,
          newSL, JSON.stringify(updatedMeta), trade.id
        );
        console.log(`[trade-mgr] Breakeven set: ${trade.market} entry=${entry} score=${score} progress=${(progress*100).toFixed(0)}%`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol: trade.market, direction: trade.direction, entry, broker: "Capital.com" });
        } catch { /* non-fatal */ }
      }
      continue;
    }

    // ── Trailing SL ───────────────────────────────────────────────────────────
    // Only after breakeven is set. Trail distance = lvl.trailDist × original SL range
    if (meta.beSet) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy
        ? currentPrice - trailDistance
        : currentPrice + trailDistance;

      // Only move SL in the direction of profit (never move it back)
      const shouldUpdate = isBuy
        ? newTrailSL > currentSL
        : newTrailSL < currentSL;

      if (shouldUpdate) {
        const updateResult = await capitalUpdatePosition(session.apiKey, session.cst, session.securityToken, positionDealId, newTrailSL);
        if (updateResult.ok) {
          const updatedMeta = { ...meta, trailActive: true, trailSL: newTrailSL };
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "stopLoss"=$1, notes=$2, "updatedAt"=NOW() WHERE id=$3`,
            newTrailSL, JSON.stringify(updatedMeta), trade.id
          );
          console.log(`[trade-mgr] Trail SL: ${trade.market} newSL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        }
      }
    }
  }
}
