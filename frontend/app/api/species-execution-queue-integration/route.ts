import { NextResponse } from "next/server";
import { getSpeciesExecutionQueueIntegrationReport } from "../../../lib/species-execution-queue-integration";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesExecutionQueueIntegrationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
