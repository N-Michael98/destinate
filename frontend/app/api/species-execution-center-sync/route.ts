import { NextResponse } from "next/server";
import { getSpeciesExecutionCenterSyncReport } from "../../../lib/species-execution-center-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesExecutionCenterSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
