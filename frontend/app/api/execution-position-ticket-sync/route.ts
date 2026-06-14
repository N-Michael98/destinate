export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateExecutionPositionTicketSyncReport } from "../../../lib/execution-position-ticket-sync";

export async function GET() {
  const report = generateExecutionPositionTicketSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
