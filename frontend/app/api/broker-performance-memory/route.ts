import { NextResponse } from "next/server";
import { generateBrokerPerformanceMemoryReport } from "../../../lib/broker-performance-memory";

export async function GET() {
  const report = generateBrokerPerformanceMemoryReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
