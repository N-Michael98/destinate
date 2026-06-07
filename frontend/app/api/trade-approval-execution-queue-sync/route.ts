import { NextResponse } from "next/server";
import { getTradeApprovalExecutionQueueSyncReport } from "../../../lib/trade-approval-execution-queue-sync";

export async function GET() {
  const report = getTradeApprovalExecutionQueueSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
