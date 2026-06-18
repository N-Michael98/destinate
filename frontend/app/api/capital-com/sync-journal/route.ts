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

async function fetchActivity(apiKey: string, cst: string, token: string): Promise<{ ok: boolean; activities: Record<string, unknown>[]; error?: string }> {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const toIso = new Date().toISOString().slice(0, 19);
  const fromIso = new Date(Date.now() - oneDayMs).toISOString().slice(0, 19);

  const attempts = [
    `${DEMO_BASE}/history/activity?lastPeriod=${oneDayMs}`,
    `${DEMO_BASE}/history/activity?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    `${DEMO_BASE}/history/activity`,
  ];

  for (const url of attempts) {
    const res = await fetch(url, { headers: authHeaders(apiKey, cst, token) });
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      return { ok: true, activities: (data.activities ?? []) as Record<string, unknown>[] };
    }
  }
  return { ok: false, activities: [], error: "All attempts failed" };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { debug?: boolean };

  if (!isCapitalConnected()) {
    return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
  }

  const session = getCapitalSession()!;
  const { ok, activities, error } = await fetchActivity(session.apiKey, session.cst, session.securityToken);

  if (!ok) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (body.debug) {
    return NextResponse.json({ ok: true, debug: true, count: activities.length, sample: activities.slice(0, 3) });
  }

  const db = getPrisma();
  let imported = 0;
  let skipped = 0;

  for (const a of activities) {
    const details = (a.details ?? {}) as Record<string, unknown>;
    const actions = Array.isArray(details.actions) ? details.actions as Record<string, unknown>[] : [];

    // Get P&L — Capital.com returns as string "+163.62" or "-15.72" or number
    const pnlRaw = details.profitAndLoss ?? details.profit ?? 0;
    const profitLoss = typeof pnlRaw === "string"
      ? parseFloat(pnlRaw.replace("+", "")) || 0
      : Number(pnlRaw);

    // Try to get dealId from multiple locations
    const closeAction = actions.find((act) => String(act.actionType ?? "").toUpperCase().includes("CLOSE"));
    const dealId = String(
      closeAction?.affectedDealId ?? a.dealId ?? details.dealReference ?? ""
    );

    // Accept this activity if it has a P&L value OR has a CLOSE action
    const hasPnl = Math.abs(profitLoss) > 0.001;
    const hasClose = !!closeAction;
    if (!hasPnl && !hasClose) continue;
    if (!dealId) continue;

    const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";
    const epic = String(a.epic ?? details.epic ?? "");
    const direction = String(details.direction ?? "BUY");
    const openLevel = Number(details.openLevel ?? details.level ?? 0);
    const closeLevel = Number(details.closeLevel ?? 0);
    const size = Number(details.dealSize ?? details.size ?? 0);

    // Check if already in DB by dealId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db.$queryRawUnsafe as any)(
      `SELECT id, status FROM "Trade" WHERE notes LIKE $1 LIMIT 1`,
      `%${dealId}%`
    ) as Array<{ id: number; status: string }>;

    if (existing.length > 0) {
      // Update if it exists as OPEN
      if (existing[0].status === "OPEN") {
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "status" = 'CLOSED', "result" = $1, "profitLoss" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
          result_str, profitLoss, existing[0].id
        );
        imported++;
      } else {
        skipped++;
      }
      continue;
    }

    // Insert as new CLOSED trade
    const dateStr = String(a.date ?? new Date().toISOString()).slice(0, 19).replace("T", " ");
    await db.$executeRawUnsafe(
      `INSERT INTO "Trade" (
        "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
        "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
        "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'Capital.com DEMO | Sync', $3, 0, 0,
        'CLOSED', $4, $5, $6, 1, 0, 0, $7, $8,
        $9::timestamp, NOW()
      )`,
      epic || "UNKNOWN",
      direction,
      openLevel,
      result_str,
      profitLoss,
      session.balance > 0 ? session.balance : 10000,
      size,
      JSON.stringify({ dealId, broker: "Capital.com DEMO", source: "sync", closeLevel, date: a.date }),
      dateStr
    );
    imported++;
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    total: activities.length,
    message: `${imported} Trades importiert/aktualisiert, ${skipped} bereits vorhanden`
  });
}

// GET — returns raw activity for debugging
export async function GET() {
  if (!isCapitalConnected()) return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" });
  const session = getCapitalSession()!;
  const { ok, activities, error } = await fetchActivity(session.apiKey, session.cst, session.securityToken);
  return NextResponse.json({ ok, error, count: activities.length, activities: activities.slice(0, 5) });
}
