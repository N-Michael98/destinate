export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { isCapitalConnected, getCapitalSession } from "../../../../lib/capital-com/capital-com-session";
import { capitalGetClosedPositions } from "../../../../lib/capital-com/capital-com-client";
import { getPrisma } from "../../../lib/prisma";

export async function POST() {
  if (!isCapitalConnected()) {
    return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
  }

  const session = getCapitalSession()!;
  const result = await capitalGetClosedPositions(session.apiKey, session.cst, session.securityToken, 7);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const db = getPrisma();
  let imported = 0;
  let skipped = 0;

  for (const pos of result.positions ?? []) {
    if (!pos.dealId) { skipped++; continue; }

    // Check if already in DB (by dealId in notes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db.$queryRawUnsafe as any)(
      `SELECT id FROM "Trade" WHERE notes LIKE $1 LIMIT 1`,
      `%${pos.dealId}%`
    ) as Array<{ id: number }>;

    if (existing.length > 0) { skipped++; continue; }

    const profitLoss = pos.profitLoss ?? 0;
    const result_str = profitLoss > 0 ? "WIN" : profitLoss < 0 ? "LOSS" : "CLOSED";

    await db.$executeRawUnsafe(
      `INSERT INTO "Trade" (
        "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
        "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
        "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, 0, 0,
        'CLOSED', $5, $6, $7, 1, 0, 0, $8, $9,
        $10::timestamp, NOW()
      )`,
      pos.symbol || pos.epic,
      pos.direction,
      "Capital.com DEMO | Auto-Import",
      pos.openLevel,
      result_str,
      profitLoss,
      session.balance > 0 ? session.balance : 10000,
      pos.size,
      JSON.stringify({
        dealId: pos.dealId,
        broker: "Capital.com DEMO",
        source: "sync-import",
        openDate: pos.openDate,
        closeDate: pos.closeDate,
        closeLevel: pos.closeLevel,
      }),
      pos.openDate
    );
    imported++;
  }

  return NextResponse.json({ ok: true, imported, skipped, total: (result.positions ?? []).length });
}
