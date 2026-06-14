export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getMultiTimeframeTradeApprovalSyncReport } from "../../../lib/multi-timeframe-trade-approval-sync";

export async function GET() {
  const report = getMultiTimeframeTradeApprovalSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
