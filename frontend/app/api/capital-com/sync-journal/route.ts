export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { isCapitalConnected, getCapitalSession } from "../../../../lib/capital-com/capital-com-session";
import { getPrisma } from "../../../lib/prisma";

const DEMO_BASE = "https://demo-api-capital.backend-capital.com/api/v1";

function authHeaders(apiKey: string, cst: string, token: string) {
  return {
    "X-CAP-API-KEY": apiKey,
    "CST": cst,
    "X-SECURITY-TOKEN": token,
    "Content-Type": "application/json",
  };
}

// GET — debug: show raw data from Capital.com endpoints
export async function GET() {
  if (!isCapitalConnected()) return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" });
  const session = getCapitalSession()!;
  const h = authHeaders(session.apiKey, session.cst, session.securityToken);

  const results: Record<string, unknown> = {};

  // Try open positions
  try {
    const r = await fetch(`${DEMO_BASE}/positions`, { headers: h });
    results.positions = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { results.positions = { error: String(e) }; }

  // Try transactions
  try {
    const r = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=604800&pageSize=500`, { headers: h });
    results.transactions = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { results.transactions = { error: String(e) }; }

  // Try activity with different params
  try {
    const r = await fetch(`${DEMO_BASE}/history/activity?lastPeriod=86400`, { headers: h });
    results.activity_lastPeriod_86400 = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { results.activity_lastPeriod_86400 = { error: String(e) }; }

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { debug?: boolean };

  if (!isCapitalConnected()) {
    return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
  }

  const session = getCapitalSession()!;
  const h = authHeaders(session.apiKey, session.cst, session.securityToken);
  const db = getPrisma();
  let imported = 0;
  let skipped = 0;

  // ── Step 1: Get currently OPEN positions from Capital.com ──────────────────
  const posRes = await fetch(`${DEMO_BASE}/positions`, { headers: h });
  const openDealIds = new Set<string>();

  if (posRes.ok) {
    const posData = await posRes.json() as { positions?: Record<string, unknown>[] };
    for (const p of posData.positions ?? []) {
      const pos = (p.position ?? p) as Record<string, unknown>;
      const dealId = String(pos.dealId ?? "");
      if (dealId) openDealIds.add(dealId);
    }
  }

  // ── Step 2: Mark OPEN DB trades as CLOSED if no longer in Capital.com ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openDbTrades = await (db.$queryRawUnsafe as any)(
    `SELECT id, market, direction, notes FROM "Trade" WHERE "status" = 'OPEN' AND notes LIKE '%dealId%'`
  ) as Array<{ id: number; market: string; direction: string; notes: string }>;

  for (const t of openDbTrades) {
    let meta: { dealId?: string } = {};
    try { meta = JSON.parse(t.notes); } catch { continue; }
    if (!meta.dealId || openDealIds.has(meta.dealId)) continue;

    // Position closed — mark as CLOSED (P&L unknown without history API)
    await db.$executeRawUnsafe(
      `UPDATE "Trade" SET "status" = 'CLOSED', "result" = 'CLOSED', "updatedAt" = NOW() WHERE "id" = $1`,
      t.id
    );
    imported++;
  }

  // ── Step 3: Try /history/transactions for P&L ─────────────────────────────
  const txRes = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=604800&pageSize=500`, { headers: h });
  let txCount = 0;
  let txTradeCount = 0;

  if (txRes.ok) {
    const txData = await txRes.json() as { transactions?: Record<string, unknown>[] };
    const allTx = txData.transactions ?? [];
    txCount = allTx.length;

    if (body.debug) {
      return NextResponse.json({ ok: true, debug: true, transactions: allTx.slice(0, 5), openDealIds: [...openDealIds] });
    }

    for (const tx of allTx) {
      if (String(tx.transactionType ?? "") !== "TRADE") continue;
      txTradeCount++;
      const dealId = String(tx.dealId ?? tx.reference ?? "");
      if (!dealId) continue;

      const pnlRaw = tx.size ?? tx.profitAndLoss ?? tx.pnl ?? tx.amount ?? 0;
      const profitLoss = typeof pnlRaw === "string"
        ? parseFloat(String(pnlRaw).replace("+", "")) || 0
        : Number(pnlRaw);

      if (Math.abs(profitLoss) < 0.0001) continue; // skip literally-zero entries only

      // Spread losses (e.g. -2.34) are LOSS not BREAKEVEN
      const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

      // Match by exact dealId OR by market+direction+CLOSED within 24h window (position vs working order ID mismatch)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (db.$queryRawUnsafe as any)(
        `SELECT id, status FROM "Trade"
         WHERE notes::text LIKE $1
         OR (
           "market" = $2
           AND ("profitLoss" = 0 OR "profitLoss" IS NULL)
           AND notes::text NOT LIKE '%"source":"tx-sync"%'
         )
         ORDER BY id DESC LIMIT 1`,
        `%"dealId":"${dealId}"%`,
        String(tx.instrumentName ?? "")
      ) as Array<{ id: number; status: string }>;

      if (existing.length > 0) {
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "status"='CLOSED', "result" = $1, "profitLoss" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
          result_str, profitLoss, existing[0].id
        );
        imported++;
      } else {
        const epic = String(tx.instrumentName ?? tx.epic ?? "UNKNOWN");
        const dateStr = String(tx.date ?? tx.dateUtc ?? new Date().toISOString()).slice(0, 19).replace("T", " ");
        await db.$executeRawUnsafe(
          `INSERT INTO "Trade" (
            "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
            "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
            "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
          ) VALUES ($1,'BUY','Capital.com DEMO | Sync',0,0,0,'CLOSED',$2,$3,$4,1,0,0,0,$5,$6::timestamp,NOW())`,
          epic, result_str, profitLoss,
          session.balance > 0 ? session.balance : 10000,
          JSON.stringify({ dealId, broker: "Capital.com DEMO", source: "tx-sync" }),
          dateStr
        );
        imported++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    txStatus: txRes.status,
    txTotal: txCount,
    txTrades: txTradeCount,
    message: `${imported} Trades aktualisiert`
  });
}
