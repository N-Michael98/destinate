export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

/**
 * READ-ONLY Diagnose für den P&L-Erfassungs-Bug.
 * Zeigt roh: (1) letzte Capital-Transactions, (2) letzte Capital-Activities,
 * (3) gespeicherte dealIds aus der DB (OPEN + zuletzt CLOSED).
 * Verändert NICHTS. Nur zur Ursachen-Beweisführung.
 *
 * Aufruf (eingeloggt): https://www.destinate.ch/api/debug-pnl
 */
export async function GET() {
  try {
    const { getCapitalSession, isCapitalConnected } = await import("../../../lib/capital-com/capital-com-session");
    const { getPrisma } = await import("../../lib/prisma");

    if (!isCapitalConnected()) {
      return NextResponse.json({ error: "Capital nicht verbunden" });
    }
    const session = getCapitalSession()!;
    const DEMO_BASE = "https://demo-api-capital.backend-capital.com/api/v1";
    const headers = { "X-CAP-API-KEY": session.apiKey, "CST": session.cst, "X-SECURITY-TOKEN": session.securityToken };

    // (1) transactions (der Endpoint den der Sync nutzt) — roh, erste 5
    let transactions: unknown[] = [];
    try {
      const r = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=86400`, { headers });
      if (r.ok) {
        const d = await r.json() as { transactions?: unknown[] };
        transactions = (d.transactions ?? []).slice(0, 5);
      } else {
        transactions = [{ httpError: r.status }];
      }
    } catch (e) { transactions = [{ fetchError: String(e) }]; }

    // (2) activity (der alternative Endpoint) — roh, erste 5
    let activities: unknown[] = [];
    try {
      const from = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 19);
      const to = new Date().toISOString().slice(0, 19);
      const r = await fetch(`${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=50`, { headers });
      if (r.ok) {
        const d = await r.json() as { activities?: unknown[] };
        activities = (d.activities ?? []).slice(0, 5);
      } else {
        activities = [{ httpError: r.status }];
      }
    } catch (e) { activities = [{ fetchError: String(e) }]; }

    // (3) gespeicherte dealIds aus der DB — OPEN + zuletzt CLOSED
    const db = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Array<{ id: number; market: string; status: string; result: string; profitLoss: number; notes: string }> =
      await (db.$queryRawUnsafe as any)(
        `SELECT "id","market","status","result","profitLoss","notes" FROM "Trade"
         WHERE "notes" LIKE '%dealId%' ORDER BY "updatedAt" DESC LIMIT 15`
      );
    const dbTrades = rows.map(t => {
      let dealId: string | undefined;
      let pnlRetries: unknown;
      try { const m = JSON.parse(t.notes); dealId = m.dealId; pnlRetries = m.pnlRetries; } catch { /* skip */ }
      return { id: t.id, market: t.market, status: t.status, result: t.result, profitLoss: t.profitLoss, dealId, pnlRetries };
    });

    return NextResponse.json({
      hint: "Vergleiche: db.dealId  vs.  transaction.dealId/reference  vs.  activity.dealId/affectedDealId. Wo steht der echte P&L?",
      transactionsRaw: transactions,
      activitiesRaw: activities,
      dbTrades,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
