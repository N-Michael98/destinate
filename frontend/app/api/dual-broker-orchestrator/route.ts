export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDualBrokerOrchestratorReport } from "../../../lib/dual-broker-orchestrator";

export async function GET() {
  const report = getDualBrokerOrchestratorReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
