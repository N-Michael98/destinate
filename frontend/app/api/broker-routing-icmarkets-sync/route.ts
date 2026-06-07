import { NextResponse } from "next/server";
import { getBrokerRoutingICMarketsSyncReport } from "../../../lib/broker-routing-icmarkets-sync";

export async function GET() {
  const report = getBrokerRoutingICMarketsSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
