export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getTradingStylePriorityTradeApprovalSyncReport } from "../../../lib/trading-style-priority-trade-approval-sync";

export async function GET() {
  const report = getTradingStylePriorityTradeApprovalSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
