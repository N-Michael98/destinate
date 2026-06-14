export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateSmartBrokerExecutionSyncReport } from "../../../lib/smart-broker-execution-sync";

export async function GET() {
  const report = generateSmartBrokerExecutionSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
