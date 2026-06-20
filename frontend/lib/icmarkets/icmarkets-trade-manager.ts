/**
 * IC Markets Active Trade Manager
 * Mirrors capital active-trade-manager.ts but uses cTrader MCP tools.
 * Runs every 2 min alongside Capital.com manager.
 *
 * Levels (same as Capital.com):
 *   score ≥ 80: BE at 70% to TP, Trail 40% SL dist, Exit at -70% SL
 *   score ≥ 75: BE at 55% to TP, Trail 50% SL dist, Exit at -50% SL
 *   score  <75: BE at 40% to TP, Trail 60% SL dist, Exit at -30% SL
 */

import { getPrisma } from "../../app/lib/prisma";
import { icGetPositions, icUpdatePosition, icClosePosition, icGetPrice } from "./icmarkets-client";
import { isICMarketsConnected } from "./icmarkets-session";

// Our symbol → cTrader symbol
const IC_SYMBOL_MAP: Record<string, string> = {
  US100: "NAS100", US500: "SPX500", GER40: "GER40", UK100: "UK100",
  GOLD: "XAUUSD", SILVER: "XAGUSD", OIL: "USOIL",
};
function toCtrader(symbol: string): string {
  return IC_SYMBOL_MAP[symbol] ?? symbol;
}

interface TradeMeta {
  dealId?: string;
  icPositionId?: string;
  confidence?: number;
  beSet?: boolean;
  trailActive?: boolean;
  trailSL?: number;
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

export async function runICMarketsTradeManager(): Promise<void> {
  if (!isICMarketsConnected()) return;

  const db = getPrisma();

  // Get live IC Markets positions
  const posResult = await icGetPositions();
  if (!posResult.ok || !posResult.positions?.length) return;

  // Map: icPositionId → live position data
  const liveMap = new Map(posResult.positions.map((p) => [p.positionId, p]));

  // Get open trades that have an IC Markets position ID stored
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openTrades = await (db.$queryRawUnsafe as any)(
    `SELECT id, market, direction, entry, "stopLoss", "takeProfit", notes
     FROM "Trade"
     WHERE status = 'OPEN'
       AND "stopLoss" > 0
       AND "takeProfit" > 0
       AND notes LIKE '%icPositionId%'`
  ) as OpenTrade[];

  for (const trade of openTrades) {
    let meta: TradeMeta = {};
    try { meta = JSON.parse(trade.notes); } catch { continue; }
    if (!meta.icPositionId) continue;

    const livePos = liveMap.get(meta.icPositionId);
    if (!livePos) continue; // already closed

    // Get current price from cTrader
    const ctraderSymbol = toCtrader(trade.market);
    const priceResult = await icGetPrice(ctraderSymbol);
    if (!priceResult.ok) continue;

    const currentPrice = trade.direction === "BUY" ? priceResult.bid! : priceResult.ask!;
    if (!currentPrice) continue;

    const entry = trade.entry > 0 ? trade.entry : livePos.openPrice;
    const stopLoss = trade.stopLoss;
    const takeProfit = trade.takeProfit;
    if (!entry || entry === 0) continue;

    const isBuy = trade.direction === "BUY";
    const totalRange = Math.abs(takeProfit - entry);
    const slRange = Math.abs(entry - stopLoss);
    if (totalRange < 0.00001 || slRange < 0.00001) continue;

    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    const pnlFraction = isBuy
      ? (currentPrice - entry) / slRange
      : (entry - currentPrice) / slRange;

    const score = meta.confidence ?? 72;
    const lvl = getLevel(score);
    const currentSL = meta.trailSL ?? stopLoss;

    // ── Early Exit ────────────────────────────────────────────────────────────
    if (!meta.beSet && pnlFraction < -lvl.exitAt) {
      const closeResult = await icClosePosition(meta.icPositionId);
      if (closeResult.ok) {
        const updatedMeta = { ...meta, icClosedBy: "active-manager-early-exit", icClosedAt: new Date().toISOString() };
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET notes=$1, "updatedAt"=NOW() WHERE id=$2`,
          JSON.stringify(updatedMeta), trade.id
        );
        console.log(`[ic-trade-mgr] Early exit: ${trade.market} ${trade.direction} pnl=${pnlFraction.toFixed(2)}`);
      }
      continue;
    }

    // ── Breakeven ─────────────────────────────────────────────────────────────
    if (!meta.beSet && progress >= lvl.beAt) {
      const updateResult = await icUpdatePosition(meta.icPositionId, entry, trade.takeProfit);
      if (updateResult.ok) {
        const updatedMeta = { ...meta, beSet: true, trailActive: false, trailSL: entry };
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET notes=$1, "updatedAt"=NOW() WHERE id=$2`,
          JSON.stringify(updatedMeta), trade.id
        );
        console.log(`[ic-trade-mgr] Breakeven: ${trade.market} entry=${entry} progress=${(progress*100).toFixed(0)}%`);
      }
      continue;
    }

    // ── Trailing SL ───────────────────────────────────────────────────────────
    if (meta.beSet) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy ? currentPrice - trailDistance : currentPrice + trailDistance;

      const shouldUpdate = isBuy ? newTrailSL > currentSL : newTrailSL < currentSL;
      if (shouldUpdate) {
        const updateResult = await icUpdatePosition(meta.icPositionId, newTrailSL, trade.takeProfit);
        if (updateResult.ok) {
          const updatedMeta = { ...meta, trailActive: true, trailSL: newTrailSL };
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET notes=$1, "updatedAt"=NOW() WHERE id=$2`,
            JSON.stringify(updatedMeta), trade.id
          );
          console.log(`[ic-trade-mgr] Trail SL: ${trade.market} newSL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        }
      }
    }
  }
}
