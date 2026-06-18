// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPrisma } from "../../lib/prisma";

export async function GET() {
  try {
    const db = getPrisma();

    const trades = await db.$queryRawUnsafe<Array<{
      id: string;
      market: string;
      direction: string;
      strategy: string;
      entry: number;
      stopLoss: number;
      takeProfit: number;
      status: string;
      result: string;
      profitLoss: number;
      riskPercent: number;
      riskAmount: number;
      riskReward: number;
      positionSize: number;
      notes: string;
      createdAt: string;
      updatedAt: string;
    }>>(`SELECT * FROM "Trade" ORDER BY "createdAt" DESC LIMIT 200`);

    const closed = trades.filter((t) => t.status === "CLOSED");
    const open = trades.filter((t) => t.status === "OPEN");
    const wins = closed.filter((t) => t.profitLoss > 0 || t.result === "WIN");
    const losses = closed.filter((t) => t.profitLoss < 0 || t.result === "LOSS");
    const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
    const totalPnL = closed.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
    const avgRR = closed.length > 0
      ? Number((closed.reduce((sum, t) => sum + (t.riskReward ?? 0), 0) / closed.length).toFixed(2))
      : 0;
    const grossProfit = wins.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.profitLoss ?? 0), 0));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;
    const avgConfidence = trades.length > 0
      ? Math.round(trades.reduce((s, t) => {
          try { return s + (JSON.parse(t.notes ?? "{}").confidence ?? 0); } catch { return s; }
        }, 0) / trades.length)
      : 0;

    // Build results in component-compatible format
    const results = trades.slice(0, 50).map((t) => {
      let meta: Record<string, unknown> = {};
      try { meta = JSON.parse(t.notes ?? "{}"); } catch {}
      const style = t.strategy?.split("|")[0]?.trim() ?? "DAYTRADING";
      const strategy = t.strategy?.split("|")[1]?.trim() ?? t.strategy ?? "—";
      const outcome = t.status === "OPEN" ? "PENDING"
        : (t.profitLoss > 0 ? "WIN" : t.profitLoss < 0 ? "LOSS" : "BREAKEVEN");
      return {
        resultId: t.id,
        symbol: t.market,
        side: t.direction as "BUY" | "SELL",
        tradingStyle: style,
        strategy,
        confidenceScore: (meta.confidence as number) ?? 0,
        evolvedLotSize: t.positionSize,
        entryPrice: t.entry,
        exitPrice: 0,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        riskPercent: t.riskPercent,
        actualRR: t.riskReward,
        expectedRR: t.riskReward,
        pnlPercent: t.riskAmount > 0
          ? Number(((t.profitLoss / t.riskAmount) * t.riskPercent).toFixed(2))
          : t.accountSize > 0
            ? Number(((t.profitLoss / t.accountSize) * 100).toFixed(2))
            : Number((t.profitLoss ?? 0).toFixed(2)),
        outcome,
        hitTarget: outcome === "WIN",
        hitStop: outcome === "LOSS",
        barsHeld: 0,
        slippagePercent: 0,
        profitLoss: t.profitLoss ?? 0,
        dealId: (meta.dealId as string) ?? null,
        broker: (meta.broker as string) ?? "Capital.com DEMO",
        executedAt: t.createdAt,
        closedAt: t.status === "CLOSED" ? t.updatedAt : null,
        note: `${style} | Confidence: ${meta.confidence ?? "—"}% | Deal: ${meta.dealId ?? "—"}`,
      };
    });

    const report = {
      version: "Real Trades",
      status: trades.length > 0 ? "ACTIVE" : "NO TRADES YET",
      mode: "Capital.com DEMO",
      sessionId: "live",
      source: "real_trades",
      results,
      metrics: {
        totalSignals: trades.length,
        completedTrades: closed.length,
        pendingTrades: open.length,
        wins: wins.length,
        losses: losses.length,
        breakevens: closed.length - wins.length - losses.length,
        winRate,
        avgRR,
        profitFactor,
        expectedValuePerTrade: closed.length > 0 ? Number((totalPnL / closed.length).toFixed(2)) : 0,
        totalPnlPercent: Number(totalPnL.toFixed(2)),
        avgConfidenceScore: avgConfidence,
        avgEvolvedLotSize: trades.length > 0
          ? Number((trades.reduce((s, t) => s + (t.positionSize ?? 0), 0) / trades.length).toFixed(2))
          : 0,
        bestTrade: wins.length > 0
          ? wins.reduce((a, b) => (a.profitLoss > b.profitLoss ? a : b)).market
          : "—",
        worstTrade: losses.length > 0
          ? losses.reduce((a, b) => (a.profitLoss < b.profitLoss ? a : b)).market
          : "—",
      },
      byStyle: (() => {
        const map: Record<string, { trades: number; wins: number; pnl: number }> = {};
        for (const t of closed) {
          const s = t.strategy?.split("|")[0]?.trim() ?? "UNKNOWN";
          if (!map[s]) map[s] = { trades: 0, wins: 0, pnl: 0 };
          map[s].trades++;
          if (t.profitLoss > 0) map[s].wins++;
          map[s].pnl += t.profitLoss ?? 0;
        }
        return Object.entries(map).map(([style, s]) => ({
          style,
          trades: s.trades,
          wins: s.wins,
          winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0,
          pnl: Number(s.pnl.toFixed(2)),
        }));
      })(),
      loopSource: "Capital.com DEMO Auto-Execution",
      summary: `${trades.length} real trades executed. Win rate: ${winRate}%. Total P&L: ${totalPnL.toFixed(2)}.`,
      safety: { liveTradingEnabled: false as const, orderExecutionEnabled: false as const, forwardTestMode: "DEMO" },
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), report: null }, { status: 500 });
  }
}
