import { NextResponse } from "next/server";
import { getUnifiedDecisionTradeApprovalSyncReport } from "../../../lib/unified-decision-trade-approval-sync";

export async function GET() {
  const report = getUnifiedDecisionTradeApprovalSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
