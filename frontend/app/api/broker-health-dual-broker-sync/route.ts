import { NextResponse } from "next/server";
import { getBrokerHealthDualBrokerSyncReport } from "../../../lib/broker-health-dual-broker-sync";

export async function GET() {
  const report = getBrokerHealthDualBrokerSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
