import { NextResponse } from "next/server";
import { generateExecutionQueuePositionSyncReport } from "../../../lib/execution-queue-position-sync";

export async function GET() {
  const report = generateExecutionQueuePositionSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
