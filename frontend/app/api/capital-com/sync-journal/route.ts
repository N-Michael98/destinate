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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { debug?: boolean };

  if (!isCapitalConnected()) {
    return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
  }

  const session = getCapitalSession()!;

  // Try Capital.com /history/activity with lastPeriod (ms) — fallback to from/to
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const fromIso = new Date(Date.now() - sevenDaysMs).toISOString().slice(0, 19);
  const toIso = new Date().toISOString().slice(0, 19);

  // Try lastPeriod first, then from/to
  let actRes = await fetch(
    `${DEMO_BASE}/history/activity?lastPeriod=${sevenDaysMs}&pageSize=100`,
    { headers: authHeaders(session.apiKey, session.cst, session.securityToken) }
  );

  if (!actRes.ok) {
    // Fallback: from/to ISO format
    actRes = await fetch(
      `${DEMO_BASE}/history/activity?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      { headers: authHeaders(session.apiKey, session.cst, session.securityToken) }
    );
  }

  if (!actRes.ok) {
    const errText = await actRes.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `Capital.com /history/activity: HTTP ${actRes.status} — ${errText.slice(0, 200)}` }, { status: 500 });
  }

  const rawData = await actRes.json() as Record<string, unknown>;

  // Return raw data in debug mode
  if (body.debug) {
    return NextResponse.json({ ok: true, debug: true, raw: rawData });
  }

  const activities = (rawData.activities ?? []) as Record<string, unknown>[];
  const db = getPrisma();
  let imported = 0;
  let skipped = 0;

  for (const a of activities) {
    const details = (a.details ?? {}) as Record<string, unknown>;
    const actions = Array.isArray(details.actions) ? details.actions as Record<string, unknown>[] : [];

    // Find DEAL_CLOSED action — this tells us a position was closed
    const closeAction = actions.find((act) =>
      String(act.actionType ?? "").toUpperCase().includes("CLOSE")
    );
    if (!closeAction) continue;

    // The affectedDealId is the dealId of the position that was closed
    const dealId = String(closeAction.affectedDealId ?? a.dealId ?? "");
    if (!dealId) continue;

    // Parse P&L — Capital.com returns it as string "+163.62" or "-15.72"
    const pnlRaw = String(details.profitAndLoss ?? "0");
    const profitLoss = parseFloat(pnlRaw.replace("+", "")) || 0;
    const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

    // Check if already in DB (open trade with this dealId, or already imported)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db.$queryRawUnsafe as any)(
      `SELECT id FROM "Trade" WHERE notes LIKE $1 LIMIT 1`,
      `%${dealId}%`
    ) as Array<{ id: number }>;

    if (existing.length > 0) {
      // If it exists as OPEN, update to CLOSED with real P&L
      const existingId = existing[0].id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const openCheck = await (db.$queryRawUnsafe as any)(
        `SELECT id FROM "Trade" WHERE id = $1 AND "status" = 'OPEN'`,
        existingId
      ) as Array<{ id: number }>;

      if (openCheck.length > 0) {
        const epic = String(a.epic ?? details.epic ?? "");
        const closeLevel = Number(details.closeLevel ?? details.level ?? 0);
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "status" = 'CLOSED', "result" = $1, "profitLoss" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
          result_str, profitLoss, existingId
        );
        console.log(`[sync] Updated OPEN→CLOSED: ${epic} ${result_str} P&L=${profitLoss}`);
        imported++;
      } else {
        skipped++;
      }
      continue;
    }

    // New trade — insert as CLOSED
    const epic = String(a.epic ?? details.epic ?? "");
    const direction = String(details.direction ?? "BUY") as "BUY" | "SELL";
    const openLevel = Number(details.openLevel ?? details.level ?? 0);
    const closeLevel = Number(details.closeLevel ?? 0);
    const size = Number(details.dealSize ?? details.size ?? 0);

    await db.$executeRawUnsafe(
      `INSERT INTO "Trade" (
        "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
        "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
        "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'Capital.com DEMO | Auto-Import', $3, 0, 0,
        'CLOSED', $4, $5, $6, 1, 0, 0, $7, $8,
        $9::timestamp, NOW()
      )`,
      epic,
      direction,
      openLevel,
      result_str,
      profitLoss,
      session.balance > 0 ? session.balance : 10000,
      size,
      JSON.stringify({
        dealId,
        broker: "Capital.com DEMO",
        source: "sync-import",
        closeLevel,
        profitAndLoss: pnlRaw,
        date: a.date,
      }),
      String(a.date ?? new Date().toISOString()).replace("T", " ").slice(0, 19)
    );
    imported++;
    console.log(`[sync] Imported: ${epic} ${direction} ${result_str} P&L=${profitLoss} deal=${dealId}`);
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    total: activities.length,
    message: `${imported} Trades importiert/aktualisiert, ${skipped} bereits vorhanden`
  });
}

// GET — debug: return raw Capital.com activity log
export async function GET() {
  if (!isCapitalConnected()) {
    return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" });
  }

  const session = getCapitalSession()!;
  const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const to = new Date().toISOString().slice(0, 19);

  try {
    const res = await fetch(
      `${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=20`,
      { headers: authHeaders(session.apiKey, session.cst, session.securityToken) }
    );
    const data = await res.json();
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
