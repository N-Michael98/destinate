export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getOutcomeLearningAutoUpdateReport } from "../../../lib/outcome-learning-auto-update";

export async function GET() {
  try {
    const report = getOutcomeLearningAutoUpdateReport();
    return NextResponse.json({ ok: true, report, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: true, report: null, error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() });
  }
}
