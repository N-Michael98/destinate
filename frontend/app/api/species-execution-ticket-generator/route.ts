import { NextResponse } from "next/server";
import { getSpeciesExecutionTicketGeneratorReport } from "../../../lib/species-execution-ticket-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesExecutionTicketGeneratorReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
