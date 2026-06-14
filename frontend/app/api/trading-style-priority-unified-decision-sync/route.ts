export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getTradingStylePriorityUnifiedDecisionSyncReport } from "../../../lib/trading-style-priority-unified-decision-sync";

export async function GET() {
  const report = getTradingStylePriorityUnifiedDecisionSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
