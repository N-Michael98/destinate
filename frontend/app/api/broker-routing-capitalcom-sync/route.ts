export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getBrokerRoutingCapitalComSyncReport } from "../../../lib/broker-routing-capitalcom-sync";

export async function GET() {
  const report = getBrokerRoutingCapitalComSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
