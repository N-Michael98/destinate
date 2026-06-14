export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getBrokerHealthMonitorReport } from "../../../lib/broker-health-monitor";

export async function GET() {
  const report = getBrokerHealthMonitorReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
