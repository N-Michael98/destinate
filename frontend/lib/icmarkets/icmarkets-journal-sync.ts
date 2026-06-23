/**
 * IC Markets Journal Sync
 * Reads closed deals from cTrader via get_deals and updates Trade DB records.
 * Mirrors capital-trade-tracker.ts pattern.
 */

import { getPrisma } from "../../app/lib/prisma";
import { isICMarketsConnected } from "./icmarkets-session";
import { icGetDeals } from "./icmarkets-client";

interface ICDeal {
  positionId: string;
  symbol: string;
  direction: string;
  volume: number;
  entryPrice: number;
  closePrice: number;
  netProfit: number;
  closeTime: string;
}

async function getClosedDeals(fromTimestamp?: number): Promise<ICDeal[]> {
  const res = await icGetDeals(fromTimestamp);
  if (!res.ok || !res.deals?.length) return [];
  return res.deals.map((d) => ({
    positionId: String(d.positionId ?? d.dealId ?? d.id ?? ""),
    symbol: String(d.symbol ?? d.symbolName ?? ""),
    direction: String(d.tradeSide ?? d.direction ?? "BUY"),
    volume: Number(d.volume ?? 0),
    entryPrice: Number(d.entryPrice ?? d.openPrice ?? 0),
    closePrice: Number(d.closePrice ?? d.exitPrice ?? 0),
    netProfit: Number(d.netProfit ?? d.profitLoss ?? 0),
    closeTime: String(d.closeTime ?? d.closeTimestamp ?? new Date().toISOString()),
  }));
}

export async function syncICMarketsJournal(): Promise<{ synced: number; skipped: number }> {
  if (!isICMarketsConnected() || !MCP_TOKEN) return { synced: 0, skipped: 0 };

  const db = getPrisma();
  let synced = 0;
  let skipped = 0;

  // Only look at last 7 days
  const fromTs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const deals = await getClosedDeals(fromTs);

  for (const deal of deals) {
    if (!deal.positionId || deal.netProfit === 0) { skipped++; continue; }

    // Find matching open trade by icPositionId in notes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades = await (db.$queryRawUnsafe as any)(
      `SELECT id, status, notes FROM "Trade"
       WHERE notes::text LIKE $1
         AND status = 'OPEN'
       LIMIT 1`,
      `%"icPositionId":"${deal.positionId}"%`
    ) as Array<{ id: number; status: string; notes: string }>;

    if (!trades.length) { skipped++; continue; }

    const trade = trades[0];
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(trade.notes); } catch { /* ok */ }

    const profitLoss = deal.netProfit;
    const result = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

    await db.$executeRawUnsafe(
      `UPDATE "Trade"
       SET status = 'CLOSED',
           result = $1,
           "profitLoss" = $2,
           "closePrice" = $3,
           "updatedAt" = NOW(),
           notes = $4
       WHERE id = $5`,
      result,
      profitLoss,
      deal.closePrice,
      JSON.stringify({ ...meta, icClosePrice: deal.closePrice, icClosedAt: deal.closeTime, source: "ic-sync" }),
      trade.id
    );

    console.log(`[ic-journal-sync] ${deal.symbol} ${deal.direction} → ${result} CHF ${profitLoss.toFixed(2)}`);
    synced++;
  }

  return { synced, skipped };
}
