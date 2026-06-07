import { NextResponse } from "next/server";
import { generateAutonomousBrokerOptimizationReport } from "../../../lib/autonomous-broker-optimization";

export async function GET() {
  const report = generateAutonomousBrokerOptimizationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
