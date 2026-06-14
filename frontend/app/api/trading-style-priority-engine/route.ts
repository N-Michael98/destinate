export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getTradingStylePriorityEngineReport } from "../../../lib/trading-style-priority-engine";

export async function GET() {
  const report = getTradingStylePriorityEngineReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
