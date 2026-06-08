import { NextResponse } from "next/server";
import { getSpeciesBrokerExecutionSyncReport } from "../../../lib/species-broker-execution-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesBrokerExecutionSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
