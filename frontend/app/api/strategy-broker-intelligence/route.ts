export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateStrategyBrokerIntelligenceReport } from "../../../lib/strategy-broker-intelligence";

export async function GET() {
  const report = generateStrategyBrokerIntelligenceReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
