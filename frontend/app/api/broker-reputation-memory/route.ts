export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateBrokerReputationMemoryReport } from "../../../lib/broker-reputation-memory";

export async function GET() {
  const report = generateBrokerReputationMemoryReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
