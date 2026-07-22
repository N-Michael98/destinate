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

    // gespeicherte dealIds aus der DB — OPEN + zuletzt CLOSED
    const db = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Array<{ id: number; market: string; status: string; result: string; profitLoss: number; entry: number; direction: string; notes: string }> =
      await (db.$queryRawUnsafe as any)(
        `SELECT "id","market","status","result","profitLoss","entry","direction","notes" FROM "Trade"
         WHERE "notes" LIKE '%dealId%' ORDER BY "updatedAt" DESC LIMIT 15`
      );
    const dbTrades = rows.map(t => {
      let dealId: string | undefined;
      let pnlRetries: unknown;
      try { const m = JSON.parse(t.notes); dealId = m.dealId; pnlRetries = m.pnlRetries; } catch { /* skip */ }
      return { id: t.id, market: t.market, status: t.status, result: t.result, profitLoss: t.profitLoss, entry: t.entry, direction: t.direction, dealId, pnlRetries };
    });

    // ── TRADE-Transaktionen (P&L in size) — korrekt mit 24h (86400) ──────────
    let allTx: Record<string, unknown>[] = [];
    try {
      const r = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=86400`, { headers });
      if (r.ok) allTx = ((await r.json() as { transactions?: Record<string, unknown>[] }).transactions ?? []);
    } catch { /* skip */ }
    const tradeTx = allTx
      .filter(tx => String(tx.transactionType ?? "") === "TRADE")
      .map(tx => ({ instrumentName: tx.instrumentName, dealId: tx.dealId, reference: tx.reference, size_PnL: tx.size, dateUtc: tx.dateUtc }));

    // ── CLOSE-Aktivitäten gezielt herausfiltern (affectedDealId + profitAndLoss)
    const from = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 19);
    const to = new Date().toISOString().slice(0, 19);
    let allAct: Record<string, unknown>[] = [];
    try {
      // detailed=true → Capital liefert erst dann details.actions[].affectedDealId
      const r = await fetch(`${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=200&detailed=true`, { headers });
      if (r.ok) allAct = ((await r.json() as { activities?: Record<string, unknown>[] }).activities ?? []);
    } catch { /* skip */ }
    const closeActs = allAct
      .filter(a => {
        const details = (a.details ?? {}) as Record<string, unknown>;
        const actions = Array.isArray(details.actions) ? details.actions as Record<string, unknown>[] : [];
        return String(a.type ?? "").includes("POSITION") ||
               actions.some(act => String(act.actionType ?? "").includes("CLOSE"));
      })
      .slice(0, 10)
      .map(a => {
        const details = (a.details ?? {}) as Record<string, unknown>;
        return {
          epic: a.epic ?? details.epic,
          source: a.source,
          activityDealId: a.dealId,       // == transaction.dealId (mit P&L)
          openPrice: details.openPrice,   // == DB.entry ?
          direction: details.direction,
        };
      });

    // Eine CLOSE-Aktivität komplett roh (um mit detailed=true die volle Struktur zu sehen)
    const firstCloseRaw = allAct.find(a => {
      const details = (a.details ?? {}) as Record<string, unknown>;
      const actions = Array.isArray(details.actions) ? details.actions as Record<string, unknown>[] : [];
      return String(a.type ?? "").includes("POSITION") || actions.some(act => String(act.actionType ?? "").includes("CLOSE"));
    }) ?? null;

    return NextResponse.json({
      hint: "detailed=true getestet. firstCloseActivityRaw zeigt die volle Struktur. Steht jetzt affectedDealId ODER der P&L drin?",
      counts: { totalTx: allTx.length, tradeTx: tradeTx.length, totalActivities: allAct.length, closeActivities: closeActs.length },
      tradeTransactions: tradeTx,
      closeActivities: closeActs,
      firstCloseActivityRaw: firstCloseRaw,
      dbTrades: dbTrades.slice(0, 12),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
