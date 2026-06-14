export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateAdaptiveBrokerWeightingReport } from "../../../lib/adaptive-broker-weighting";

export async function GET() {
  const report = generateAdaptiveBrokerWeightingReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
