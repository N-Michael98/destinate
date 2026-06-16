export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateExecutionQueuePositionSyncReport } from "../../../lib/execution-queue-position-sync";
import { isCapitalConnected, autoReconnectCapital } from "../../../lib/capital-com/capital-com-session";

export async function GET() {
  // Fire reconnect in background — don't block the response
  if (!isCapitalConnected()) {
    autoReconnectCapital().catch(() => {});
  }

  const report = generateExecutionQueuePositionSyncReport();
  const capitalComActive = isCapitalConnected();

  return NextResponse.json({
    ok: true,
    report: { ...report, capitalComActive },
  });
}
