export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getMultiTimeframeUnifiedDecisionSyncReport } from "../../../lib/multi-timeframe-unified-decision-sync";

export async function GET() {
  const report = getMultiTimeframeUnifiedDecisionSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
