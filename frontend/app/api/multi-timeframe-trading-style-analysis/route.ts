import { NextResponse } from "next/server";
import { getMultiTimeframeTradingStyleAnalysisReport } from "../../../lib/multi-timeframe-trading-style-analysis";

export async function GET() {
  const report = getMultiTimeframeTradingStyleAnalysisReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
