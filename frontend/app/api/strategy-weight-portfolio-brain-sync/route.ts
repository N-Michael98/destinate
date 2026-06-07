import { NextResponse } from "next/server";
import { getStrategyWeightPortfolioBrainSyncReport } from "../../../lib/strategy-weight-portfolio-brain-sync";

export async function GET() {
  const report = getStrategyWeightPortfolioBrainSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
