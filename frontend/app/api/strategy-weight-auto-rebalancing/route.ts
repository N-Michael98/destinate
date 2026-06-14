export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getStrategyWeightAutoRebalancingReport } from "../../../lib/strategy-weight-auto-rebalancing";

export async function GET() {
  const report = getStrategyWeightAutoRebalancingReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
