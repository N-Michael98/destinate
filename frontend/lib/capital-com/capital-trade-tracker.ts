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
        "id", "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
        "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
        "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
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
    const { capitalGetPositions } = await import("./capital-com-client");

    if (!isCapitalConnected()) return;
    const session = getCapitalSession()!;

    const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
    if (!posResult.ok) return;

    const openDealIds = new Set(
      (posResult.positions ?? []).map((p) => {
        try {
          return (p as { dealId?: string }).dealId ?? "";
        } catch { return ""; }
      }).filter(Boolean)
    );

    const db = getPrisma();
    // Find all OPEN trades in DB that have a dealId in notes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openTrades: Array<{ id: string; market: string; direction: string; entry: number; stopLoss: number; takeProfit: number; notes: string }> = await (db.$queryRawUnsafe as any)(`SELECT "id", "market", "direction", "entry", "stopLoss", "takeProfit", "notes" FROM "Trade" WHERE "status" = 'OPEN' AND "notes" LIKE '%dealId%'`);

    for (const trade of openTrades) {
      let meta: { dealId?: string } = {};
      try { meta = JSON.parse(trade.notes); } catch { continue; }
      if (!meta.dealId || openDealIds.has(meta.dealId)) continue;

      // Position closed on Capital.com — determine WIN or LOSS
      // We approximate: check if current price (last known) hit SL or TP
      // Simple heuristic: if no live price available, mark as CLOSED without result
      const result = "CLOSED"; // Would need live price to determine WIN/LOSS
      let profitLoss = 0;

      // Try to get last position data from Capital.com closed positions
      // For now mark as CLOSED — the position monitor will update when price data available
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "status" = 'CLOSED', "result" = $1, "profitLoss" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
        result,
        profitLoss,
        trade.id
      );
      console.log(`[trade-tracker] Trade closed: ${trade.market} ${trade.direction} deal=${meta.dealId}`);
    }
  } catch (err) {
    console.error("[trade-tracker] syncCapitalPositions error:", err);
  }
}
