import { NextResponse } from "next/server";
import { getSpeciesExecutionQueueReport } from "../../../lib/species-execution-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesExecutionQueueReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
