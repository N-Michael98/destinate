export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getOutcomeLearningAutoUpdateReport } from "../../../lib/outcome-learning-auto-update";

export async function GET() {
  const report = getOutcomeLearningAutoUpdateReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
