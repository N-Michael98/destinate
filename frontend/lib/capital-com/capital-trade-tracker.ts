// Capital.com Trade Tracker
// Saves executed trades to DB, monitors positions for SL/TP hit, updates Journal

import { getPrisma } from "../../app/lib/prisma";

export interface TradeRecord {
  dealId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  tradingStyle: string;
  strategy: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  accountBalance: number;
  riskPercent: number;
  confidence: number;
}

export async function saveCapitalTradeToJournal(trade: TradeRecord): Promise<void> {
  try {
    const db = getPrisma();
    const riskAmount = trade.accountBalance * (trade.riskPercent / 100);
    const riskPerUnit = Math.abs(trade.entry - trade.stopLoss);
    const rewardPerUnit = Math.abs(trade.takeProfit - trade.entry);
    const riskReward = riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 0;
    const positionSize = trade.size;

    await db.$executeRawUnsafe(
      `INSERT INTO "Trade" (
        "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
        "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
        "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'OPEN', 'OPEN', 0, $7, $8, $9, $10, $11, $12,
        NOW(), NOW()
      )`,
      trade.symbol,
      trade.direction,
      `${trade.tradingStyle} | ${trade.strategy}`,
      trade.entry,
      trade.stopLoss > 0 ? trade.stopLoss : 0,
      trade.takeProfit > 0 ? trade.takeProfit : 0,
      trade.accountBalance,
      trade.riskPercent,
      riskAmount,
      riskReward,
      positionSize,
      JSON.stringify({
        dealId: trade.dealId,
        tradingStyle: trade.tradingStyle,
        confidence: trade.confidence,
        broker: "Capital.com DEMO",
        source: "auto-scan",
      })
    );
    console.log(`[trade-tracker] Saved trade: ${trade.symbol} ${trade.direction} (${trade.tradingStyle}) deal=${trade.dealId}`);
  } catch (err) {
    console.error("[trade-tracker] Failed to save trade:", err);
  }
}

// Called from background monitor — fetches open Capital.com positions and closes finished trades
export async function syncCapitalPositionsToJournal(): Promise<void> {
  try {
    const { getCapitalSession, isCapitalConnected } = await import("./capital-com-session");
    const { capitalGetPositions, capitalGetClosedPositions } = await import("./capital-com-client");

    if (!isCapitalConnected()) return;
    const session = getCapitalSession()!;

    const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
    if (!posResult.ok) return;

    const openDealIds = new Set(
      (posResult.positions ?? []).map((p) => p.dealId ?? "").filter(Boolean)
    );

    // Fetch closed positions from Capital.com to get real P&L
    const closedResult = await capitalGetClosedPositions(session.apiKey, session.cst, session.securityToken, 1);
    const closedByDealId = new Map(
      (closedResult.positions ?? []).map((p) => [p.dealId, p])
    );

    const db = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openTrades: Array<{ id: number; market: string; direction: string; entry: number; stopLoss: number; takeProfit: number; notes: string }> = await (db.$queryRawUnsafe as any)(
      `SELECT "id", "market", "direction", "entry", "stopLoss", "takeProfit", "notes" FROM "Trade" WHERE "status" = 'OPEN' AND "notes" LIKE '%dealId%'`
    );

    for (const trade of openTrades) {
      let meta: { dealId?: string } = {};
      try { meta = JSON.parse(trade.notes); } catch { continue; }
      if (!meta.dealId || openDealIds.has(meta.dealId)) continue;

      // Position is no longer open — get real P&L from Capital.com closed history
      const closed = closedByDealId.get(meta.dealId);
      const profitLoss = closed?.profitLoss ?? 0;
      const closeLevel = closed?.closeLevel ?? 0;

      // Determine WIN/LOSS/BREAKEVEN based on actual P&L
      const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

      // Update notes with close data
      let updatedMeta: Record<string, unknown> = {};
      try { updatedMeta = JSON.parse(trade.notes); } catch { updatedMeta = {}; }
      updatedMeta.closeLevel = closeLevel;
      updatedMeta.closedAt = new Date().toISOString();

      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "status" = 'CLOSED', "result" = $1, "profitLoss" = $2, "notes" = $3, "updatedAt" = NOW() WHERE "id" = $4`,
        result_str,
        profitLoss,
        JSON.stringify(updatedMeta),
        trade.id
      );
      console.log(`[trade-tracker] Closed: ${trade.market} ${trade.direction} → ${result_str} P&L=${profitLoss} deal=${meta.dealId}`);
    }
  } catch (err) {
    console.error("[trade-tracker] syncCapitalPositions error:", err);
  }
}
