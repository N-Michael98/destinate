export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateExecutionQueuePositionSyncReport } from "../../../lib/execution-queue-position-sync";
import { isCapitalConnected, autoReconnectCapital } from "../../../lib/capital-com/capital-com-session";

export async function GET() {
  // Auto-reconnect if session missing (cooldown prevents rate limiting)
  if (!isCapitalConnected()) {
    await autoReconnectCapital().catch(() => {});
  }

  const report = generateExecutionQueuePositionSyncReport();
  const capitalComActive = isCapitalConnected();

  return NextResponse.json({
    ok: true,
    report: { ...report, capitalComActive },
  });
}
