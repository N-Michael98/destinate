export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAIExecutionSchedulerReport } from "../../../lib/ai-execution-scheduler";

export async function GET() {
  const report = getAIExecutionSchedulerReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
