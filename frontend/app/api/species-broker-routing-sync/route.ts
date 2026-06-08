import { NextResponse } from "next/server";
import { getSpeciesBrokerRoutingSyncReport } from "../../../lib/species-broker-routing-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesBrokerRoutingSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
