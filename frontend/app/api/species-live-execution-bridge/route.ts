import { NextResponse } from "next/server";
import { getSpeciesLiveExecutionBridgeReport } from "../../../lib/species-live-execution-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesLiveExecutionBridgeReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
