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

    // ── Match-Test: für jeden CLOSED DB-Trade prüfen, welcher Matcher greift ──
    // (a) transactions TRADE per dealId  (b) activity CLOSE per affectedDealId
    // Vollständige Listen holen (nicht nur die ersten 5) für den Test:
    let allTx: Record<string, unknown>[] = [];
    let allAct: Record<string, unknown>[] = [];
    try {
      const r = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=604800`, { headers });
      if (r.ok) allTx = ((await r.json() as { transactions?: Record<string, unknown>[] }).transactions ?? []);
    } catch { /* skip */ }
    try {
      const from = new Date(Date.now() - 604800 * 1000).toISOString().slice(0, 19);
      const to = new Date().toISOString().slice(0, 19);
      const r = await fetch(`${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=200`, { headers });
      if (r.ok) allAct = ((await r.json() as { activities?: Record<string, unknown>[] }).activities ?? []);
    } catch { /* skip */ }

    // Map per Transaction-dealId (aktueller Sync-Weg)
    const txByDealId = new Map<string, unknown>();
    for (const tx of allTx) {
      if (String(tx.transactionType ?? "") !== "TRADE") continue;
      const id = String(tx.dealId ?? "");
      if (id) txByDealId.set(id, { size: tx.size, ref: tx.reference, name: tx.instrumentName });
    }
    // Map per activity affectedDealId (Kandidat-Weg)
    const actByAffected = new Map<string, unknown>();
    for (const a of allAct) {
      const details = (a.details ?? {}) as Record<string, unknown>;
      const actions = Array.isArray(details.actions) ? details.actions as Record<string, unknown>[] : [];
      for (const act of actions) {
        const aff = String(act.affectedDealId ?? "");
        if (aff) actByAffected.set(aff, { actionType: act.actionType, pnl: details.profitAndLoss ?? details.profit, epic: details.epic ?? a.epic });
      }
    }

    const matchTest = dbTrades.slice(0, 10).map(t => ({
      market: t.market,
      dbDealId: t.dealId,
      matchByTxDealId: t.dealId ? (txByDealId.get(t.dealId) ?? null) : null,
      matchByActivityAffected: t.dealId ? (actByAffected.get(t.dealId) ?? null) : null,
    }));

    return NextResponse.json({
      hint: "matchByTxDealId = aktueller Sync-Weg (offenbar null). matchByActivityAffected = Kandidat-Fix. Welcher liefert Daten?",
      counts: { transactions: allTx.length, activities: allAct.length, txTradeEntries: txByDealId.size, activityAffectedEntries: actByAffected.size },
      matchTest,
      transactionsRaw: transactions,
      activitiesRaw: activities,
      dbTrades,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
